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
      for (const f of fs.readdirSync(dir)) {
        const fp = path.join(dir, f);
        if (fs.statSync(fp).isFile()) fs.unlinkSync(fp);
      }
      let count = 0;
      for (const file of clientFiles) {
        const safeName = path.basename(String(file.name || ''));
        if (!safeName || safeName.startsWith('.')) continue;
        fs.writeFileSync(path.join(dir, safeName), String(file.content ?? ''));
        count++;
      }
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
    for (const f of fs.readdirSync(dir)) {
      const fp = path.join(dir, f);
      if (fs.statSync(fp).isFile()) fs.unlinkSync(fp);
    }
    let count = 0;
    for (const file of room?.files || []) {
      if (file.type && file.type !== 'file') continue;
      const safeName = path.basename(String(file.name || ''));
      if (!safeName || safeName.startsWith('.')) continue;
      fs.writeFileSync(path.join(dir, safeName), String(file.content ?? ''));
      count++;
    }
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

module.exports = { registerTerminalHandlers };
