/**
 * Test Explorer backend — run Node's built-in test runner (`node --test`)
 * against a workspace file and parse the TAP output into a pass/fail list.
 *
 * Registered by assembly at /api (do NOT mount here).
 *
 * POST /api/testrun { roomId?, files, testFile }
 *   files:    [{ id, name, type, parentId, content }] (same shape TerminalPanel sends)
 *   testFile: project-relative path of a *.test.* / *.spec.* file
 * Responds: { ok, exitCode, timedOut, durationMs, total, pass, fail, skipped,
 *             tests: [{ name, ok, skipped }], raw }
 *
 * Honest scope: Node's built-in runner only (node:test). Jest/Vitest
 * projects should use the integrated terminal instead.
 */
const express = require('express');
const path = require('path');
const fs = require('fs');
const { execFile } = require('child_process');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// ─── TAP parsing (pure — exported for unit tests) ───────────────────────────
// Parses TAP version 13 as emitted by `node --test --test-reporter=tap`.
// Nested subtests (indented) are folded into a tree; the per-test list
// contains LEAF tests (the ones the user actually wrote). Totals prefer the
// runner's own `# pass` / `# fail` summary lines when present.
function parseTap(text) {
  // Node's TAP nests subtests: a `# Subtest: NAME` comment precedes an
  // indented block, and the parent's own `ok K - NAME` line closes the
  // block AFTER its children. So we track open subtest blocks on a stack;
  // the matching parent line adopts the block as its children. Anything
  // left open (crashed run) is flushed as-is.
  const root = [];
  const pending = []; // stack of { name, indent, nodes }
  let pass = null;
  let fail = null;
  let skipped = null;
  let total = null;
  let durationMs = null;
  let inYaml = false;

  const flushPending = () => {
    while (pending.length) {
      const blk = pending.pop();
      for (const n of blk.nodes) root.push(n);
    }
  };

  const lines = String(text || '').split('\n');
  for (let raw of lines) {
    const line = raw.replace(/\r$/, '');

    // YAML diagnostic block: lines between a lone '---' and '...'
    if (inYaml) {
      if (/^\s*\.\.\.\s*$/.test(line)) inYaml = false;
      continue;
    }
    if (/^\s*---\s*$/.test(line)) {
      inYaml = true;
      continue;
    }

    // Summary lines: '# pass 3', '# fail 0', '# tests 5', '# skipped 1'
    let sm = line.match(/^#\s*(tests|pass|fail|skipped|todo|cancelled)\s+(\d+)\s*$/i);
    if (sm) {
      const n = Number(sm[2]);
      const key = sm[1].toLowerCase();
      if (key === 'pass') pass = n;
      else if (key === 'fail') fail = n;
      else if (key === 'skipped') skipped = n;
      else if (key === 'tests') total = n;
      continue;
    }
    sm = line.match(/^#\s*duration_ms\s+([\d.]+)/i);
    if (sm) {
      durationMs = Number(sm[1]);
      continue;
    }

    const sub = line.match(/^\s*#\s*Subtest:\s*(.+?)\s*$/);
    if (sub) {
      pending.push({ name: sub[1], indent: null, nodes: [] });
      continue;
    }
    if (/^#/.test(line)) continue; // other comments

    const tm = line.match(/^(\s*)(not ok|ok)\s+(\d+)\s*(?:-\s*)?(.*?)\s*$/);
    if (!tm) continue;

    const indent = tm[1].length;
    const ok = tm[2] === 'ok';
    let name = tm[4].trim() || `test ${tm[3]}`;
    const isSkipped = /#\s*SKIP\b/i.test(line);
    if (isSkipped) name = name.replace(/#\s*SKIP.*$/i, '').trim();

    let node = { indent, ok: isSkipped ? true : ok, skipped: isSkipped, name, children: [] };

    // Does this line close the innermost open subtest block?
    while (pending.length) {
      const blk = pending[pending.length - 1];
      if (node.name === blk.name && (blk.indent === null || indent <= blk.indent)) {
        pending.pop();
        node.children = blk.nodes;
        continue; // the completed block may itself close an outer block
      }
      break;
    }
    if (pending.length) {
      const blk = pending[pending.length - 1];
      if (blk.indent === null) blk.indent = indent;
      blk.nodes.push(node);
    } else {
      root.push(node);
    }
  }
  flushPending();

  // Flat pre-order list of EVERY TAP result line (parents included):
  // Node's own `# tests`/`# pass`/`# fail` summary counts suite parents too,
  // so listing all of them keeps the list and the totals consistent.
  const flat = [];
  const walk = (node, prefix) => {
    const label = prefix ? `${prefix} › ${node.name}` : node.name;
    flat.push({
      name: label,
      ok: node.ok,
      skipped: !!node.skipped,
      suite: node.children.length > 0,
    });
    for (const c of node.children) walk(c, label);
  };
  for (const c of root) walk(c, '');

  const countedOk = flat.filter((t) => t.ok && !t.skipped).length;
  const countedSkipped = flat.filter((t) => t.skipped).length;
  const countedFail = flat.filter((t) => !t.ok).length;

  return {
    tests: flat,
    total: total !== null ? total : flat.length,
    pass: pass !== null ? pass : countedOk,
    fail: fail !== null ? fail : countedFail,
    skipped: skipped !== null ? skipped : countedSkipped,
    durationMs,
  };
}

// ─── Workspace writing ──────────────────────────────────────────────────────
// Prefer the real prepareWorkspace from terminalManager (same layout as
// terminal/debug runs). It requires the Room model, so in environments where
// that can't load we fall back to a small self-contained writer that builds
// the identical folder layout from the parentId chains.
let _prepare = undefined;
function getPrepareWorkspace() {
  if (_prepare !== undefined) return _prepare;
  try {
    _prepare = require('../socket/terminalManager').prepareWorkspace || null;
  } catch {
    _prepare = null;
  }
  return _prepare;
}

function sanitizeSegment(name) {
  const clean = String(name || '').replace(/[\\/:*?"<>|\x00-\x1f]/g, '_').trim();
  if (!clean || clean === '.' || clean === '..') return '';
  return clean;
}

function folderPathFor(item, byId) {
  const parts = [];
  const seen = new Set([item.id]);
  let parentId = item.parentId || null;
  while (parentId) {
    if (seen.has(parentId)) return null;
    seen.add(parentId);
    const parent = byId.get(parentId);
    if (!parent || parent.type !== 'folder') break;
    const seg = sanitizeSegment(parent.name);
    if (seg) parts.unshift(seg);
    parentId = parent.parentId || null;
  }
  return parts;
}

function writeWorkspaceTree(dir, files) {
  const list = Array.isArray(files) ? files : [];
  const byId = new Map(list.map((f) => [f.id, f]));
  const root = path.resolve(dir);
  for (const f of list) {
    if (f.type !== 'folder') continue;
    const parts = folderPathFor(f, byId);
    const own = sanitizeSegment(f.name);
    if (!parts || !own) continue;
    const target = path.resolve(root, ...parts, own);
    if (target.startsWith(root + path.sep)) fs.mkdirSync(target, { recursive: true });
  }
  for (const f of list) {
    if (f.type && f.type !== 'file') continue;
    const base = path.basename(String(f.name || ''));
    if (!base || base.startsWith('.')) continue;
    const parts = folderPathFor(f, byId) || [];
    const target = path.resolve(root, ...parts, base);
    if (!target.startsWith(root + path.sep)) continue;
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, String(f.content ?? ''));
  }
}

// Fallback used only when terminalManager can't be required (it pulls in the
// Room/Mongoose models). Builds the same solo/room directory layout.
async function prepareWorkspaceFallback(roomId, files, userId) {
  let dir;
  if (!roomId && Array.isArray(files) && files.length > 0) {
    const safeUser = String(userId || 'anon').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 32) || 'anon';
    dir = path.join(__dirname, '..', 'workspaces', 'solo-' + safeUser);
  } else {
    const cleanId = String(roomId || '').trim().toUpperCase();
    if (!cleanId || !/^[A-Z0-9]{4,16}$/.test(cleanId)) return null;
    dir = path.join(__dirname, '..', 'workspaces', cleanId);
    // Without the Room model we can't read the DB; the client always sends
    // its files, so use them (rooms + socket sync keep them current).
  }
  try {
    fs.mkdirSync(dir, { recursive: true });
    for (const entry of fs.readdirSync(dir)) {
      fs.rmSync(path.join(dir, entry), { recursive: true, force: true });
    }
    writeWorkspaceTree(dir, files);
    return dir;
  } catch {
    return null;
  }
}

// testFile must be a plain relative test path inside the workspace.
function sanitizeTestFile(file) {
  const raw = String(file || '').replace(/\\/g, '/').trim();
  if (!raw || raw.length > 256) return null;
  if (raw.startsWith('/') || raw.includes('..')) return null;
  if (!/\.(test|spec)\.(js|mjs|cjs|ts|mts)$/.test(raw)) return null;
  if (/[~^?*:|<>]/.test(raw)) return null;
  if (!/^[A-Za-z0-9_][A-Za-z0-9_./-]*$/.test(raw)) return null;
  return raw;
}

// POST /api/testrun — run a node:test file and parse TAP.
router.post('/testrun', authMiddleware, async (req, res) => {
  const startedAt = Date.now();
  try {
    const { roomId, files, testFile } = req.body || {};
    const safeFile = sanitizeTestFile(testFile);
    if (!safeFile) {
      return res.status(400).json({
        error: 'Invalid testFile. Pick a *.test.* or *.spec.* file in the workspace.',
      });
    }
    const userId = req.user?.userId || req.user?.id;

    const prepare = getPrepareWorkspace();
    const cwd = prepare
      ? await prepare(roomId, files, userId)
      : await prepareWorkspaceFallback(roomId, files, userId);
    if (!cwd) {
      return res.status(400).json({ error: 'Could not prepare the workspace.' });
    }

    const target = path.resolve(cwd, safeFile);
    if (!target.startsWith(path.resolve(cwd) + path.sep) || !fs.existsSync(target)) {
      return res.status(400).json({ error: 'Test file not found in the workspace.' });
    }

    execFile(
      process.execPath,
      ['--test', '--test-reporter=tap', safeFile],
      {
        cwd,
        timeout: 60000,
        maxBuffer: 4 * 1024 * 1024,
        env: { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1' },
      },
      (err, stdout, stderr) => {
        const out = String(err?.stdout ?? stdout ?? '');
        const errOut = String(err?.stderr ?? stderr ?? '');
        const parsed = parseTap(out);
        const timedOut = !!err && (err.killed === true || err.code === 'ETIMEDOUT');
        res.json({
          ok: !err || err.code === 0,
          exitCode: typeof err?.code === 'number' ? err.code : err ? 1 : 0,
          timedOut,
          durationMs: Date.now() - startedAt,
          total: parsed.total,
          pass: parsed.pass,
          fail: parsed.fail,
          skipped: parsed.skipped,
          tapDurationMs: parsed.durationMs,
          tests: parsed.tests,
          raw: (out + (errOut ? '\n[stderr]\n' + errOut : '')).slice(-6000),
        });
      }
    );
  } catch (err) {
    res.status(500).json({ error: err?.message || 'Test run failed' });
  }
});

module.exports = router;
module.exports.parseTap = parseTap;
module.exports.sanitizeTestFile = sanitizeTestFile;
