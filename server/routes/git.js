const express = require('express');
const { execFile } = require('child_process');
const path = require('path');
const fs = require('fs');
const authMiddleware = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

function getUserId(req) {
  return String(req.user.userId || req.user.id || '');
}

// Resolve the workspace dir for this request (same logic as terminalManager)
function resolveWorkspace(roomId, userId) {
  const cleanRoom = String(roomId || '').trim().toUpperCase();
  if (cleanRoom && /^[A-Z0-9]{4,16}$/.test(cleanRoom)) {
    return path.join(__dirname, '..', 'workspaces', cleanRoom);
  }
  const safeUser = String(userId || 'anon').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 32) || 'anon';
  return path.join(__dirname, '..', 'workspaces', 'solo-' + safeUser);
}

function git(cwd, args, timeout = 30000) {
  return new Promise((resolve) => {
    execFile('git', args, { cwd, timeout, maxBuffer: 1024 * 1024 }, (error, stdout, stderr) => {
      resolve({
        ok: !error,
        stdout: String(stdout || ''),
        stderr: String(stderr || ''),
        code: error?.code ?? 0,
      });
    });
  });
}

function workspaceOf(req) {
  const dir = resolveWorkspace(req.query.roomId || req.body?.roomId, getUserId(req));
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

// GET /api/git/status?roomId=XXX
router.get('/status', async (req, res) => {
  try {
    const cwd = workspaceOf(req);
    const isRepo = fs.existsSync(path.join(cwd, '.git'));

    if (!isRepo) {
      const files = fs.readdirSync(cwd).filter((f) => !f.startsWith('.'));
      return res.json({ isRepo: false, files, cwd: path.basename(cwd) });
    }

    const [branchOut, statusOut] = await Promise.all([
      git(cwd, ['rev-parse', '--abbrev-ref', 'HEAD']),
      git(cwd, ['status', '--porcelain=v1', '-uall']),
    ]);

    const changes = statusOut.stdout
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        const code = line.slice(0, 2);
        const file = line.slice(3).replace(/^"(.+)"$/, '$1');
        let status = 'modified';
        if (code.includes('?')) status = 'untracked';
        else if (code.includes('A')) status = 'added';
        else if (code.includes('D')) status = 'deleted';
        else if (code.includes('R')) status = 'renamed';
        return { file, status, code: code.trim() };
      });

    // Ahead/behind
    let ahead = 0;
    let behind = 0;
    const ab = await git(cwd, ['rev-list', '--left-right', '--count', 'HEAD...@{upstream}']);
    if (ab.ok) {
      const [a, b] = ab.stdout.trim().split(/\s+/).map(Number);
      ahead = a || 0;
      behind = b || 0;
    }

    res.json({
      isRepo: true,
      branch: branchOut.stdout.trim() || 'main',
      changes,
      ahead,
      behind,
      cwd: path.basename(cwd),
    });
  } catch (err) {
    res.status(500).json({ error: 'Could not read git status.' });
  }
});

// POST /api/git/init
router.post('/init', async (req, res) => {
  try {
    const cwd = workspaceOf(req);
    const r = await git(cwd, ['init', '-b', 'main']);
    if (!r.ok) return res.status(500).json({ error: r.stderr || 'git init failed.' });
    // Auto-configure identity so commits work out of the box
    const user = req.user || {};
    const name = String(user.username || user.name || 'Synapse User').slice(0, 60);
    const email = String(user.email || 'user@synapse.local').slice(0, 80);
    await git(cwd, ['config', 'user.name', name]);
    await git(cwd, ['config', 'user.email', email]);
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'git init failed.' });
  }
});

// POST /api/git/add { files?: string[] } — stage all if omitted
router.post('/add', async (req, res) => {
  try {
    const cwd = workspaceOf(req);
    const files = Array.isArray(req.body?.files) && req.body.files.length ? req.body.files : ['-A'];
    // Sanitize: no path traversal
    const safe = files.map((f) => String(f)).filter((f) => !f.includes('..') && !path.isAbsolute(f));
    const r = await git(cwd, ['add', '--', ...safe]);
    if (!r.ok) return res.status(500).json({ error: r.stderr || 'git add failed.' });
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'git add failed.' });
  }
});

// POST /api/git/commit { message }
router.post('/commit', async (req, res) => {
  try {
    const cwd = workspaceOf(req);
    const message = String(req.body?.message || '').trim().slice(0, 500);
    if (!message) return res.status(400).json({ error: 'Commit message is required.' });
    // Ensure identity exists (repairs repos created before auto-config)
    const idCheck = await git(cwd, ['config', 'user.name']);
    if (!idCheck.ok || !idCheck.stdout.trim()) {
      const user = req.user || {};
      await git(cwd, ['config', 'user.name', String(user.username || user.name || 'Synapse User').slice(0, 60)]);
      await git(cwd, ['config', 'user.email', String(user.email || 'user@synapse.local').slice(0, 80)]);
    }
    // Stage everything first (UI promises auto-stage)
    await git(cwd, ['add', '-A']);
    const r = await git(cwd, ['commit', '-m', message]);
    if (!r.ok) {
      const errOut = (r.stderr || r.stdout || '').trim();
      // Friendlier message for common cases
      if (/nothing to commit/i.test(errOut)) {
        return res.status(400).json({ error: 'Nothing to commit — working tree is clean.' });
      }
      return res.status(500).json({ error: errOut.slice(0, 300) || 'git commit failed.' });
    }
    res.json({ ok: true, output: r.stdout });
  } catch {
    res.status(500).json({ error: 'git commit failed.' });
  }
});

// GET /api/git/log?roomId=XXX&limit=20
router.get('/log', async (req, res) => {
  try {
    const cwd = workspaceOf(req);
    if (!fs.existsSync(path.join(cwd, '.git'))) return res.json({ commits: [] });
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 50);
    const r = await git(cwd, [
      'log',
      `--max-count=${limit}`,
      '--pretty=format:%H%x1f%an%x1f%ad%x1f%s%x1e',
      '--date=relative',
    ]);
    // No commits yet -> not an error, just empty
    if (!r.ok) return res.json({ commits: [] });
    const commits = r.stdout
      .split('\x1e')
      .filter(Boolean)
      .map((entry) => {
        const [hash, author, date, subject] = entry.split('\x1f');
        return { hash: (hash || '').trim(), author, date, subject };
      });
    res.json({ commits });
  } catch {
    res.status(500).json({ error: 'Could not read git log.' });
  }
});

// POST /api/git/push / pull — pass through git output (may need auth in terminal)
router.post('/push', async (req, res) => {
  try {
    const cwd = workspaceOf(req);
    const r = await git(cwd, ['push'], 60000);
    res.json({ ok: r.ok, output: r.stdout || r.stderr });
  } catch {
    res.status(500).json({ error: 'git push failed.' });
  }
});

router.post('/pull', async (req, res) => {
  try {
    const cwd = workspaceOf(req);
    const r = await git(cwd, ['pull'], 60000);
    res.json({ ok: r.ok, output: r.stdout || r.stderr });
  } catch {
    res.status(500).json({ error: 'git pull failed.' });
  }
});

// GET /api/git/diff?file=xxx — diff for a single file
router.get('/diff', async (req, res) => {
  try {
    const cwd = workspaceOf(req);
    const file = String(req.query.file || '');
    if (!file || file.includes('..') || path.isAbsolute(file)) {
      return res.status(400).json({ error: 'Invalid file.' });
    }
    const r = await git(cwd, ['diff', 'HEAD', '--', file]);
    res.json({ diff: r.stdout || '(no diff — new file or already committed)' });
  } catch {
    res.status(500).json({ error: 'Could not read diff.' });
  }
});

module.exports = router;
