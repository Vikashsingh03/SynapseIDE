/**
 * In-browser terminal manager (node-pty + Socket.IO) — VS Code style.
 *
 * Each socket can own MULTIPLE pty sessions, keyed by terminalId.
 * All sessions are killed when the socket disconnects.
 *
 * Security notes:
 * - The pty runs as the server's OS user — only enable this on a trusted
 *   dev machine (localhost). Do NOT expose an unrestricted shell on a
 *   public server without a sandbox.
 */
const path = require('path');
const fs = require('fs');
const RoomModel = require('../models/Room');

let pty = null;
try {
  // Lazy so the server still boots when node-pty isn't installed.
  pty = require('node-pty');
} catch {
  pty = null;
}

// socket.id -> Map<terminalId, pty.Process>
const sessions = new Map();
let nextId = 1;

function getShell() {
  if (process.platform === 'win32') {
    return { file: 'powershell.exe', args: ['-NoLogo'], label: 'powershell' };
  }
  return { file: process.env.SHELL || '/bin/bash', args: ['--login'], label: 'bash' };
}

function getSocketSessions(socket) {
  if (!sessions.has(socket.id)) sessions.set(socket.id, new Map());
  return sessions.get(socket.id);
}

function killSession(socket, terminalId) {
  const map = sessions.get(socket.id);
  if (!map) return false;
  const proc = map.get(String(terminalId));
  if (proc) {
    try {
      proc.kill();
    } catch {}
    map.delete(String(terminalId));
    return true;
  }
  return false;
}

function killAllSessions(socket) {
  const map = sessions.get(socket.id);
  if (!map) return;
  for (const proc of map.values()) {
    try {
      proc.kill();
    } catch {}
  }
  sessions.delete(socket.id);
}

// ─── Folder-aware workspace writing ─────────────────────────────────────────
// File/folder names are single segments; anything path-like is sanitized so a
// name can never escape the workspace directory.
function sanitizeSegment(name) {
  const clean = String(name || '')
    .replace(/[\\/:*?"<>|\x00-\x1f]/g, '_')
    .trim();
  if (!clean || clean === '.' || clean === '..') return '';
  return clean;
}

// Root-first folder path for an item, following its parentId chain.
// Returns [] for root items, null if the chain has a cycle.
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

function cleanWorkspaceDir(dir) {
  for (const entry of fs.readdirSync(dir)) {
    fs.rmSync(path.join(dir, entry), { recursive: true, force: true });
  }
}

// Writes files at their folder paths (creating folders, incl. empty ones).
// Two files with the same name in different folders no longer overwrite
// each other. Returns the number of files written.
function writeWorkspaceTree(dir, files) {
  const list = Array.isArray(files) ? files : [];
  const byId = new Map(list.map((f) => [f.id, f]));
  const root = path.resolve(dir);
  let count = 0;

  for (const f of list) {
    if (f.type !== 'folder') continue;
    const parts = folderPathFor(f, byId);
    const own = sanitizeSegment(f.name);
    if (!parts || !own) continue;
    const target = path.resolve(root, ...parts, own);
    if (target.startsWith(root + path.sep)) {
      fs.mkdirSync(target, { recursive: true });
    }
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
    count++;
  }
  return count;
}

/**
 * Write the room's files to a real folder on disk so the terminal
 * shows the user's project (main.py, …) instead of Synapse's own code.
 */
async function prepareWorkspace(roomId, clientFiles, userId) {
  // Solo editor: client sends its local files -> per-user workspace
  if (!roomId && Array.isArray(clientFiles) && clientFiles.length > 0) {
    const safeUser = String(userId || 'anon').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 32) || 'anon';
    try {
      const dir = path.join(__dirname, '..', 'workspaces', 'solo-' + safeUser);
      fs.mkdirSync(dir, { recursive: true });
      cleanWorkspaceDir(dir);
      const count = writeWorkspaceTree(dir, clientFiles);
      console.log(`[terminal] solo workspace: wrote ${count} file(s)`);
      return dir;
    } catch (err) {
      console.error('[terminal] solo workspace error:', err.message);
      return null;
    }
  }
  const cleanId = String(roomId || '').trim().toUpperCase();
  if (!cleanId || !/^[A-Z0-9]{4,16}$/.test(cleanId)) return null;
  try {
    const room = await RoomModel.findOne({ roomId: cleanId }).select('files').lean();
    const dir = path.join(__dirname, '..', 'workspaces', cleanId);
    fs.mkdirSync(dir, { recursive: true });
    cleanWorkspaceDir(dir);
    const count = writeWorkspaceTree(dir, room?.files || []);
    console.log(`[terminal] workspace ${cleanId}: wrote ${count} file(s)`);
    return dir;
  } catch (err) {
    console.error('[terminal] workspace error:', err.message);
    return null;
  }
}

async function createSession(io, socket, roomId, clientFiles) {
  console.log('[terminal] create requested by', socket.id, 'room=' + (roomId || 'none'));
  if (!pty) {
    socket.emit('terminal:error', {
      message: 'node-pty is not installed. Run: npm install node-pty (in server/)',
    });
    return;
  }

  const { file, args, label } = getShell();
  const terminalId = String(nextId++);
  let proc;
  try {
    proc = pty.spawn(file, args, {
      name: 'xterm-256color',
      cols: 80,
      rows: 24,
      cwd: (await prepareWorkspace(roomId, clientFiles, socket.data.user?.userId)) || path.join(__dirname, '..', '..'),
      env: { ...process.env, TERM: 'xterm-256color' },
    });
  } catch (err) {
    socket.emit('terminal:error', { terminalId, message: `Could not start terminal: ${err.message}` });
    return;
  }

  getSocketSessions(socket).set(terminalId, proc);

  proc.onData((data) => {
    socket.emit('terminal:output', { terminalId, data });
  });

  proc.onExit(({ exitCode }) => {
    socket.emit('terminal:exit', { terminalId, exitCode });
    const map = sessions.get(socket.id);
    if (map) map.delete(terminalId);
  });

  console.log('[terminal] session ready for', socket.id, 'id=' + terminalId);
  socket.emit('terminal:ready', { terminalId, label });
}

function registerTerminalHandlers(io, socket) {
  console.log('[terminal] handlers registered for', socket.id);

  socket.on('terminal:create', ({ roomId, files } = {}) => createSession(io, socket, roomId, files));

  socket.on('terminal:input', ({ terminalId, data } = {}) => {
    const proc = sessions.get(socket.id)?.get(String(terminalId));
    if (proc) {
      try {
        proc.write(String(data || ''));
      } catch {}
    }
  });

  socket.on('terminal:resize', ({ terminalId, cols, rows } = {}) => {
    const proc = sessions.get(socket.id)?.get(String(terminalId));
    if (proc && cols > 0 && rows > 0) {
      try {
        proc.resize(Math.min(cols, 240), Math.min(rows, 80));
      } catch {}
    }
  });

  socket.on('terminal:kill', ({ terminalId } = {}) => {
    if (killSession(socket, terminalId)) {
      socket.emit('terminal:killed', { terminalId });
    }
  });

  // Always clean up ALL ptys when the socket goes away
  socket.on('disconnect', () => killAllSessions(socket));
}

module.exports = { registerTerminalHandlers, prepareWorkspace, writeWorkspaceTree };
