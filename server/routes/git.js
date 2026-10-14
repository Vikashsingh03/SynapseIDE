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

// ─── Wave 3: Git superpowers (branches, stash, merge-conflict file I/O) ───
// All routes below mirror the existing conventions: same auth middleware,
// workspaceOf(req) resolution (roomId from query for GETs, body for POSTs),
// execFile('git', ...) via the git() helper, path-sanitized file params.

const BRANCH_NAME_RE = /^[A-Za-z0-9][A-Za-z0-9._/-]*$/;

function validBranchName(name) {
  const s = String(name || '');
  return s.length > 0 && s.length <= 120 && BRANCH_NAME_RE.test(s) && !s.includes('..');
}

function gitErr(r, fallback) {
  return (r.stderr || r.stdout || fallback).trim().slice(0, 400) || fallback;
}

function repoDir(cwd) {
  return fs.existsSync(path.join(cwd, '.git')) ? cwd : null;
}

// GET /api/git/branches?roomId=XXX → { branches: [{name, current}], current }
router.get('/branches', async (req, res) => {
  try {
    const cwd = workspaceOf(req);
    if (!repoDir(cwd)) return res.json({ branches: [], current: null });

    let current = (await git(cwd, ['branch', '--show-current'])).stdout.trim();
    const list = await git(cwd, ['branch', '--format=%(refname:short)']);
    if (!list.ok) return res.status(500).json({ error: gitErr(list, 'Could not read branches.') });

    const names = list.stdout.split('\n').map((s) => s.trim()).filter(Boolean);

    // Fallback: parse '* <name>' from plain `git branch` (detached HEAD, old git)
    if (!current) {
      const raw = await git(cwd, ['branch']);
      const star = raw.stdout.split('\n').map((s) => s.trim()).find((s) => s.startsWith('* '));
      current = star ? star.slice(2).trim() : '';
    }

    res.json({
      branches: names.map((name) => ({ name, current: name === current })),
      current: current || null,
    });
  } catch {
    res.status(500).json({ error: 'Could not read branches.' });
  }
});

// POST /api/git/branch/create { roomId, name }
router.post('/branch/create', async (req, res) => {
  try {
    const cwd = workspaceOf(req);
    if (!repoDir(cwd)) return res.status(400).json({ error: 'Not a git repository.' });
    const name = String(req.body?.name || '').trim();
    if (!validBranchName(name)) return res.status(400).json({ error: 'Invalid branch name.' });
    const r = await git(cwd, ['branch', name]);
    if (!r.ok) return res.status(400).json({ error: gitErr(r, 'Could not create branch.') });
    res.json({ ok: true, name });
  } catch {
    res.status(500).json({ error: 'Could not create branch.' });
  }
});

// POST /api/git/branch/checkout { roomId, name }
// Checkout failures (dirty tree, conflicts) come back as 409 with git's message.
router.post('/branch/checkout', async (req, res) => {
  try {
    const cwd = workspaceOf(req);
    if (!repoDir(cwd)) return res.status(400).json({ error: 'Not a git repository.' });
    const name = String(req.body?.name || '').trim();
    if (!validBranchName(name)) return res.status(400).json({ error: 'Invalid branch name.' });
    const r = await git(cwd, ['checkout', name]);
    if (!r.ok) return res.status(409).json({ error: gitErr(r, 'Could not switch branch.') });
    res.json({ ok: true, name });
  } catch {
    res.status(500).json({ error: 'Could not switch branch.' });
  }
});

// POST /api/git/branch/delete { roomId, name } — safe delete (-d) only, never current
router.post('/branch/delete', async (req, res) => {
  try {
    const cwd = workspaceOf(req);
    if (!repoDir(cwd)) return res.status(400).json({ error: 'Not a git repository.' });
    const name = String(req.body?.name || '').trim();
    if (!validBranchName(name)) return res.status(400).json({ error: 'Invalid branch name.' });
    const current = (await git(cwd, ['branch', '--show-current'])).stdout.trim();
    if (name === current) return res.status(400).json({ error: 'Cannot delete the current branch.' });
    const r = await git(cwd, ['branch', '-d', name]);
    if (!r.ok) return res.status(400).json({ error: gitErr(r, 'Could not delete branch.') });
    res.json({ ok: true, name });
  } catch {
    res.status(500).json({ error: 'Could not delete branch.' });
  }
});

// POST /api/git/stash { roomId, action: 'push'|'pop'|'list', message?, index? }
router.post('/stash', async (req, res) => {
  try {
    const cwd = workspaceOf(req);
    if (!repoDir(cwd)) return res.status(400).json({ error: 'Not a git repository.' });
    const action = String(req.body?.action || '');

    if (action === 'list') {
      const r = await git(cwd, ['stash', 'list']);
      if (!r.ok) return res.status(500).json({ error: gitErr(r, 'Could not read stash list.') });
      const stashes = r.stdout
        .split('\n')
        .filter(Boolean)
        .map((line) => {
          const m = line.match(/^stash@{(\d+)}:\s*(.*)$/);
          if (!m) return null;
          const message = m[2].replace(/^WIP on [^:]+:\s*/, '').trim() || 'stash';
          return { index: Number(m[1]), message };
        })
        .filter(Boolean);
      return res.json({ stashes });
    }

    if (action === 'push') {
      const message = String(req.body?.message || 'synapse stash').trim().slice(0, 200) || 'synapse stash';
      const r = await git(cwd, ['stash', 'push', '-m', message]);
      const out = gitErr(r, 'Could not stash changes.');
      // Some git versions exit 0 with "No local changes to save" when only untracked files exist
      if (/no local changes/i.test(out)) {
        return res.status(400).json({ error: 'Nothing to stash — working tree is clean.' });
      }
      if (!r.ok) return res.status(400).json({ error: out });
      return res.json({ ok: true });
    }

    if (action === 'pop') {
      const idx = req.body?.index;
      const args =
        Number.isInteger(idx) && idx >= 0 ? ['stash', 'pop', `stash@{${idx}}`] : ['stash', 'pop'];
      const r = await git(cwd, ['stash', 'pop', ...args.slice(2)]);
      if (!r.ok) return res.status(409).json({ error: gitErr(r, 'Could not pop stash.') });
      return res.json({ ok: true });
    }

    return res.status(400).json({ error: 'Invalid stash action.' });
  } catch {
    res.status(500).json({ error: 'Stash operation failed.' });
  }
});

function safeWorkspaceFile(cwd, file) {
  const f = String(file || '');
  if (!f || f.includes('..') || path.isAbsolute(f)) return null;
  const abs = path.join(cwd, f);
  if (!abs.startsWith(cwd + path.sep)) return null;
  return abs;
}

// GET /api/git/file-content?roomId=XXX&file=xxx — raw working-tree file (for the conflict resolver)
router.get('/file-content', async (req, res) => {
  try {
    const cwd = workspaceOf(req);
    const abs = safeWorkspaceFile(cwd, req.query.file);
    if (!abs) return res.status(400).json({ error: 'Invalid file.' });
    let stat;
    try {
      stat = fs.statSync(abs);
    } catch {
      return res.status(404).json({ error: 'File not found in the workspace.' });
    }
    if (!stat.isFile()) return res.status(400).json({ error: 'Not a file.' });
    if (stat.size > 512 * 1024) return res.status(400).json({ error: 'File too large to edit here.' });
    res.json({ content: fs.readFileSync(abs, 'utf8') });
  } catch {
    res.status(500).json({ error: 'Could not read file.' });
  }
});

// POST /api/git/file-content { roomId, file, content } — write to the working tree (conflict resolutions)
router.post('/file-content', async (req, res) => {
  try {
    const cwd = workspaceOf(req);
    const abs = safeWorkspaceFile(cwd, req.body?.file);
    if (!abs) return res.status(400).json({ error: 'Invalid file.' });
    const content = req.body?.content;
    if (typeof content !== 'string') return res.status(400).json({ error: 'Content is required.' });
    if (content.length > 1024 * 1024) return res.status(400).json({ error: 'Content too large.' });
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content, 'utf8');
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Could not write file.' });
  }
});

module.exports = router;
