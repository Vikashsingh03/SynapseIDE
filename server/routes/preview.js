/**
 * Live Preview routes — serve the project workspace as a static site on a
 * localhost port so HTML/CSS/JS projects can be previewed inside the IDE.
 *
 *   POST /api/preview/start { roomId?, files } → { port, url, version }
 *   POST /api/preview/sync  { roomId?, files } → { version }
 *   POST /api/preview/stop  { roomId? }        → { ok: true }
 *
 * A tiny live-reload script is injected into every .html response; it polls
 * GET /__synapse_lr and reloads the page when the workspace version changes.
 * Servers are in-memory only (one per solo user / room) and never exposed
 * beyond 127.0.0.1.
 */
const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const authMiddleware = require('../middleware/auth');
const { prepareWorkspace } = require('../socket/terminalManager');

const router = express.Router();

// key → { server, port, dir, version }
const servers = new Map();

const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.cjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/plain; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
};

function keyFor(roomId, userId) {
  const cleanRoom = String(roomId || '').trim().toUpperCase();
  if (cleanRoom) return `room:${cleanRoom}`;
  const safeUser = String(userId || 'anon').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 32) || 'anon';
  return `solo:${safeUser}`;
}

// The live-reload snippet is byte-exact by contract with the panel.
function liveReloadScript(version) {
  const body = `(function(){var v=__V__;setInterval(function(){fetch('/__synapse_lr').then(function(r){return r.text()}).then(function(t){if(t!==String(v)){location.reload()}}).catch(function(){})},1000)})();`;
  return `<script>${body.split('__V__').join(String(version))}</script>`;
}

function injectLiveReload(html, version) {
  const snippet = liveReloadScript(version);
  const idx = html.toLowerCase().lastIndexOf('</body>');
  if (idx !== -1) return html.slice(0, idx) + snippet + html.slice(idx);
  return html + snippet;
}

function resolveSafe(root, rawPath) {
  let decoded;
  try {
    decoded = decodeURIComponent(rawPath);
  } catch {
    return null;
  }
  const normalized = path.normalize(decoded).replace(/^([/\\])+/, '');
  // Reject dotdot navigation outright — escaping attempts get a 400.
  if (/(^|[\\/])\.\.([\\/]|$)/.test(normalized)) return null;
  const resolved = path.resolve(root, normalized);
  if (resolved !== root && !resolved.startsWith(root + path.sep)) return null;
  return resolved;
}

async function startPreviewServer(root, getVersion) {
  const server = http.createServer((req, res) => {
    try {
      const rawUrl = String(req.url || '/').split('?')[0];

      if (rawUrl === '/__synapse_lr') {
        res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end(String(getVersion()));
        return;
      }

      if (!['GET', 'HEAD'].includes(req.method)) {
        res.writeHead(405, { 'Content-Type': 'text/plain' });
        res.end('Method not allowed');
        return;
      }

      const target = resolveSafe(root, rawUrl);
      if (!target) {
        res.writeHead(400, { 'Content-Type': 'text/plain' });
        res.end('Bad path');
        return;
      }

      let filePath = target;
      try {
        const stat = fs.statSync(filePath);
        if (stat.isDirectory()) {
          const index = path.join(filePath, 'index.html');
          if (!fs.existsSync(index)) {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('No index.html in this folder');
            return;
          }
          filePath = index;
        }
      } catch {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not found');
        return;
      }

      const ext = path.extname(filePath).toLowerCase();
      const contentType = CONTENT_TYPES[ext] || 'application/octet-stream';

      if (ext === '.html' || ext === '.htm') {
        const html = fs.readFileSync(filePath, 'utf8');
        const withLr = injectLiveReload(html, getVersion());
        res.writeHead(200, { 'Content-Type': contentType });
        if (req.method === 'HEAD') res.end();
        else res.end(withLr);
        return;
      }

      res.writeHead(200, { 'Content-Type': contentType });
      if (req.method === 'HEAD') {
        res.end();
        return;
      }
      fs.createReadStream(filePath)
        .on('error', (err) => {
          console.error('[preview] read error:', err.message);
          if (!res.headersSent) res.writeHead(500, { 'Content-Type': 'text/plain' });
          res.end('Read error');
        })
        .pipe(res);
    } catch (err) {
      console.error('[preview] request error:', err.message);
      if (!res.headersSent) res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Server error');
    }
  });

  await new Promise((resolve, reject) => {
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => resolve());
  });
  return { server, port: server.address().port };
}

async function writeFiles(roomId, files, userId) {
  const dir = await prepareWorkspace(roomId || null, files, userId);
  if (!dir) throw new Error('Could not prepare the workspace for preview');
  return dir;
}

// POST /api/preview/start
router.post('/preview/start', authMiddleware, async (req, res) => {
  try {
    const { roomId, files } = req.body || {};
    if (!Array.isArray(files) || files.length === 0) {
      return res.status(400).json({ error: 'files array is required' });
    }
    const key = keyFor(roomId, req.user?.userId);
    const dir = await writeFiles(roomId, files, req.user?.userId);

    let entry = servers.get(key);
    if (entry) {
      entry.dir = dir;
      entry.version += 1;
      return res.json({ port: entry.port, url: `http://localhost:${entry.port}`, version: entry.version });
    }

    const holder = { version: 1 };
    const { server, port } = await startPreviewServer(dir, () => holder.version);
    entry = { server, port, dir, version: 1, holder };
    servers.set(key, entry);
    server.on('error', (err) => console.error('[preview] server error:', err.message));
    server.on('close', () => {
      if (servers.get(key) === entry) servers.delete(key);
    });
    res.json({ port, url: `http://localhost:${port}`, version: 1 });
  } catch (err) {
    console.error('[preview] start error:', err?.message || err);
    res.status(500).json({ error: err?.message || 'Could not start preview' });
  }
});

// POST /api/preview/sync
router.post('/preview/sync', authMiddleware, async (req, res) => {
  try {
    const { roomId, files } = req.body || {};
    const key = keyFor(roomId, req.user?.userId);
    const entry = servers.get(key);
    if (!entry) {
      return res.status(409).json({ error: 'Preview is not running' });
    }
    if (Array.isArray(files) && files.length) {
      entry.dir = await writeFiles(roomId, files, req.user?.userId);
    }
    entry.version += 1;
    entry.holder.version = entry.version;
    res.json({ version: entry.version });
  } catch (err) {
    console.error('[preview] sync error:', err?.message || err);
    res.status(500).json({ error: err?.message || 'Could not sync preview' });
  }
});

// POST /api/preview/stop
router.post('/preview/stop', authMiddleware, async (req, res) => {
  try {
    const { roomId } = req.body || {};
    const key = keyFor(roomId, req.user?.userId);
    const entry = servers.get(key);
    if (entry) {
      servers.delete(key);
      entry.server.close();
    }
    res.json({ ok: true });
  } catch (err) {
    console.error('[preview] stop error:', err?.message || err);
    res.status(500).json({ error: err?.message || 'Could not stop preview' });
  }
});

module.exports = router;
