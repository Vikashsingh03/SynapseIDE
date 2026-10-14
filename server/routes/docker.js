const express = require('express');
const { execFile } = require('child_process');
const authMiddleware = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

// NOTE: Docker is machine-global, not per-room — unlike the git routes there
// is no workspace resolution here. Everything runs against the host's daemon.

// execFile wrapper mirroring routes/git.js — arg arrays only, NO shell strings.
function docker(args, timeout = 15000) {
  return new Promise((resolve) => {
    execFile('docker', args, { timeout, maxBuffer: 4 * 1024 * 1024 }, (error, stdout, stderr) => {
      resolve({
        ok: !error,
        stdout: String(stdout || ''),
        stderr: String(stderr || ''),
        code: error ? error.code : 0,
      });
    });
  });
}

// Map a failed docker invocation to the right 503. Returns res on error, null when ok.
function dockerGuard(r, res) {
  if (r.ok) return null;
  if (r.code === 'ENOENT') {
    return res.status(503).json({ error: 'Docker is not available on this machine' });
  }
  return res
    .status(503)
    .json({ error: 'Docker daemon is not running or unreachable' });
}

const ID_RE = /^[a-zA-Z0-9_.-]+$/; // container names, short ids, full 64-hex ids

// GET /api/docker/status — light probe, always 200 with { available }
router.get('/status', async (req, res) => {
  try {
    const r = await docker(['version', '--format', '{{.Server.Version}}'], 5000);
    if (!r.ok) return res.json({ available: false });
    return res.json({ available: true, version: r.stdout.trim() });
  } catch (err) {
    return res.json({ available: false });
  }
});

// GET /api/docker/ps — all containers
router.get('/ps', async (req, res) => {
  try {
    const r = await docker(['ps', '-a', '--format', '{{json .}}']);
    const guard = dockerGuard(r, res);
    if (guard) return guard;
    const containers = [];
    for (const line of r.stdout.split('\n')) {
      const t = line.trim();
      if (!t) continue;
      try {
        const c = JSON.parse(t);
        containers.push({
          id: c.ID || '',
          name: c.Names || '',
          image: c.Image || '',
          status: c.Status || '',
          ports: c.Ports || '',
          state: c.State || '',
        });
      } catch {
        // skip malformed lines
      }
    }
    return res.json({ containers });
  } catch (err) {
    console.error('Docker ps error:', err?.message || err);
    return res.status(500).json({ error: 'Failed to list containers' });
  }
});

// GET /api/docker/images
router.get('/images', async (req, res) => {
  try {
    const r = await docker(['images', '--format', '{{json .}}']);
    const guard = dockerGuard(r, res);
    if (guard) return guard;
    const images = [];
    for (const line of r.stdout.split('\n')) {
      const t = line.trim();
      if (!t) continue;
      try {
        const img = JSON.parse(t);
        images.push({
          repository: img.Repository || '',
          tag: img.Tag || '',
          size: img.Size || '',
          created: img.CreatedAt || '',
        });
      } catch {
        // skip malformed lines
      }
    }
    return res.json({ images });
  } catch (err) {
    console.error('Docker images error:', err?.message || err);
    return res.status(500).json({ error: 'Failed to list images' });
  }
});

// POST /api/docker/action — { id, action: 'start'|'stop'|'restart'|'remove' }
router.post('/action', async (req, res) => {
  try {
    const { id, action } = req.body || {};
    if (!id || typeof id !== 'string' || !ID_RE.test(id)) {
      return res.status(400).json({ error: 'valid container id or name is required' });
    }
    if (!['start', 'stop', 'restart', 'remove'].includes(action)) {
      return res.status(400).json({ error: 'action must be start, stop, restart or remove' });
    }
    const cmd = action === 'remove' ? 'rm' : action;
    const r = await docker([cmd, id]);
    if (!r.ok && r.code === 'ENOENT') {
      return res.status(503).json({ error: 'Docker is not available on this machine' });
    }
    const output = (r.stdout + (r.stderr ? '\n' + r.stderr : '')).trim();
    return res.json({ ok: r.ok, output });
  } catch (err) {
    console.error('Docker action error:', err?.message || err);
    return res.status(500).json({ error: 'Docker action failed' });
  }
});

// GET /api/docker/logs?id=<id>&tail=100 — docker logs writes app stderr to
// the process's stderr, so stdout and stderr are merged.
router.get('/logs', async (req, res) => {
  try {
    const { id } = req.query || {};
    if (!id || typeof id !== 'string' || !ID_RE.test(id)) {
      return res.status(400).json({ error: 'valid container id or name is required' });
    }
    const tail = Math.max(1, Math.min(1000, parseInt(req.query.tail, 10) || 100));
    const r = await docker(['logs', '--tail', String(tail), id]);
    if (!r.ok && r.code === 'ENOENT') {
      return res.status(503).json({ error: 'Docker is not available on this machine' });
    }
    if (!r.ok) {
      const output = (r.stdout + (r.stderr ? '\n' + r.stderr : '')).trim();
      return res.json({ logs: output || '(no logs)' });
    }
    const logs = (r.stdout + r.stderr).trim();
    return res.json({ logs: logs || '(no logs)' });
  } catch (err) {
    console.error('Docker logs error:', err?.message || err);
    return res.status(500).json({ error: 'Failed to fetch logs' });
  }
});

module.exports = router;
