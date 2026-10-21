










const path = require('path');
const fs = require('fs');
const RoomModel = require('../models/Room');

let pty = null;
try {
  
  pty = require('node-pty');
} catch {
  pty = null;
}


const sessions = new Map();
let nextId = 1;

const roomSessions = new Map();
const socketRoomKeys = new Map();
const SCROLLBACK_CAP = 16 * 1024;
const SHARED_GRACE_MS = Math.max(0, Number(process.env.SYNAPSE_SHARED_TERMINAL_GRACE_MS) || 30000);

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




function sanitizeSegment(name) {
  const clean = String(name || '')
    .replace(/[\\/:*?"<>|\x00-\x1f]/g, '_')
    .trim();
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

function cleanWorkspaceDir(dir) {
  for (const entry of fs.readdirSync(dir)) {
    fs.rmSync(path.join(dir, entry), { recursive: true, force: true });
  }
}




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





async function prepareWorkspace(roomId, clientFiles, userId) {
  
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

function cleanRoomId(roomId) {
  const cleanId = String(roomId || '').trim().toUpperCase();
  return /^[A-Z0-9]{4,16}$/.test(cleanId) ? cleanId : null;
}

function cleanTabId(tabId) {
  const clean = String(tabId || '').trim();
  return /^[A-Za-z0-9_-]{1,64}$/.test(clean) ? clean : null;
}

function roomTabsList(roomId) {
  const tabs = [];
  for (const session of roomSessions.values()) {
    if (session.roomId === roomId) tabs.push({ tabId: session.tabId, label: session.label });
  }
  return tabs;
}

function emitToSession(session, event, payload) {
  for (const subscriber of session.subscribers.values()) {
    try {
      subscriber.emit(event, payload);
    } catch {}
  }
}

function trackSubscription(socket, session) {
  session.subscribers.set(socket.id, socket);
  if (!socketRoomKeys.has(socket.id)) socketRoomKeys.set(socket.id, new Set());
  socketRoomKeys.get(socket.id).add(session.key);
}

function untrackSession(session) {
  for (const socketId of session.subscribers.keys()) {
    const keys = socketRoomKeys.get(socketId);
    if (keys) {
      keys.delete(session.key);
      if (keys.size === 0) socketRoomKeys.delete(socketId);
    }
  }
}

function destroySharedSession(session, notifyKilled) {
  if (session.graceTimer) {
    clearTimeout(session.graceTimer);
    session.graceTimer = null;
  }
  if (notifyKilled) emitToSession(session, 'terminal:killed', { terminalId: session.tabId });
  if (session.proc) {
    try {
      session.proc.kill();
    } catch {}
    session.proc = null;
  }
  untrackSession(session);
  session.subscribers.clear();
  roomSessions.delete(session.key);
}

function resolveSharedSession(roomId, terminalId) {
  const tabId = cleanTabId(terminalId);
  if (!tabId) return null;
  const cleanId = cleanRoomId(roomId);
  if (cleanId) return roomSessions.get(`room:${cleanId}:${tabId}`) || null;
  for (const session of roomSessions.values()) {
    if (session.tabId === tabId) return session;
  }
  return null;
}

async function spawnSharedProc(io, session) {
  const { file, args } = getShell();
  let proc;
  try {
    const cwd = (await prepareWorkspace(session.roomId, undefined, null)) || path.join(__dirname, '..', '..');
    proc = pty.spawn(file, args, {
      name: 'xterm-256color',
      cols: 80,
      rows: 24,
      cwd,
      env: { ...process.env, TERM: 'xterm-256color' },
    });
  } catch (err) {
    if (roomSessions.get(session.key) === session) {
      emitToSession(session, 'terminal:error', { terminalId: session.tabId, message: `Could not start terminal: ${err.message}` });
      destroySharedSession(session, false);
    }
    return;
  }
  if (roomSessions.get(session.key) !== session) {
    try {
      proc.kill();
    } catch {}
    return;
  }
  session.proc = proc;
  proc.onData((data) => {
    session.scrollback = (session.scrollback + data).slice(-SCROLLBACK_CAP);
    emitToSession(session, 'terminal:output', { terminalId: session.tabId, data });
  });
  proc.onExit(({ exitCode }) => {
    emitToSession(session, 'terminal:exit', { terminalId: session.tabId, exitCode });
    if (roomSessions.get(session.key) === session) destroySharedSession(session, false);
  });
}

function notifyRoomPeers(io, session) {
  const peers = new Map();
  for (const other of roomSessions.values()) {
    if (other.roomId !== session.roomId || other.key === session.key) continue;
    for (const [socketId, subscriber] of other.subscribers) {
      if (!session.subscribers.has(socketId)) peers.set(socketId, subscriber);
    }
  }
  const payload = {
    terminalId: session.tabId,
    label: session.label,
    shared: true,
    scrollback: '',
    tabs: roomTabsList(session.roomId),
  };
  for (const peer of peers.values()) {
    try {
      peer.emit('terminal:ready', payload);
    } catch {}
  }
}

function attachSharedTerminal(io, socket, roomIdRaw, tabIdRaw) {
  const roomId = cleanRoomId(roomIdRaw);
  const tabId = cleanTabId(tabIdRaw);
  if (!roomId || !tabId) {
    socket.emit('terminal:error', { message: 'Invalid shared terminal request.' });
    return;
  }
  if (!pty) {
    socket.emit('terminal:error', {
      message: 'node-pty is not installed. Run: npm install node-pty (in server/)',
    });
    return;
  }
  const key = `room:${roomId}:${tabId}`;
  let session = roomSessions.get(key);
  let created = false;
  if (!session) {
    const { label } = getShell();
    session = {
      key,
      roomId,
      tabId,
      label,
      proc: null,
      subscribers: new Map(),
      scrollback: '',
      graceTimer: null,
    };
    roomSessions.set(key, session);
    created = true;
  }
  if (session.graceTimer) {
    clearTimeout(session.graceTimer);
    session.graceTimer = null;
  }
  trackSubscription(socket, session);
  socket.emit('terminal:ready', {
    terminalId: session.tabId,
    label: session.label,
    shared: true,
    scrollback: session.scrollback,
    tabs: roomTabsList(roomId),
  });
  if (created) {
    spawnSharedProc(io, session);
    notifyRoomPeers(io, session);
  }
  console.log('[terminal] shared attach', socket.id, key, created ? '(created)' : '(joined)');
}

function detachSocketFromShared(socket) {
  const keys = socketRoomKeys.get(socket.id);
  if (!keys) return;
  for (const key of [...keys]) {
    const session = roomSessions.get(key);
    keys.delete(key);
    if (!session) continue;
    session.subscribers.delete(socket.id);
    if (session.subscribers.size === 0 && !session.graceTimer) {
      session.graceTimer = setTimeout(() => {
        session.graceTimer = null;
        if (session.subscribers.size === 0 && roomSessions.get(session.key) === session) {
          console.log('[terminal] shared grace expired, killing', session.key);
          destroySharedSession(session, false);
        }
      }, SHARED_GRACE_MS);
    }
  }
  socketRoomKeys.delete(socket.id);
}

function registerTerminalHandlers(io, socket) {
  console.log('[terminal] handlers registered for', socket.id);

  socket.on('terminal:create', ({ roomId, files, shared, tabId } = {}) => {
    if (shared) attachSharedTerminal(io, socket, roomId, tabId);
    else createSession(io, socket, roomId, files);
  });

  socket.on('terminal:input', ({ terminalId, data, roomId } = {}) => {
    const sharedSession = resolveSharedSession(roomId, terminalId);
    if (sharedSession) {
      if (!sharedSession.subscribers.has(socket.id)) trackSubscription(socket, sharedSession);
      if (sharedSession.proc) {
        try {
          sharedSession.proc.write(String(data || ''));
        } catch {}
      }
      return;
    }
    const proc = sessions.get(socket.id)?.get(String(terminalId));
    if (proc) {
      try {
        proc.write(String(data || ''));
      } catch {}
    }
  });

  socket.on('terminal:resize', ({ terminalId, cols, rows, roomId } = {}) => {
    const sharedSession = resolveSharedSession(roomId, terminalId);
    if (sharedSession) {
      if (sharedSession.proc && cols > 0 && rows > 0) {
        try {
          sharedSession.proc.resize(Math.min(cols, 240), Math.min(rows, 80));
        } catch {}
      }
      return;
    }
    const proc = sessions.get(socket.id)?.get(String(terminalId));
    if (proc && cols > 0 && rows > 0) {
      try {
        proc.resize(Math.min(cols, 240), Math.min(rows, 80));
      } catch {}
    }
  });

  socket.on('terminal:kill', ({ terminalId, roomId } = {}) => {
    const sharedSession = resolveSharedSession(roomId, terminalId);
    if (sharedSession) {
      destroySharedSession(sharedSession, true);
      return;
    }
    if (killSession(socket, terminalId)) {
      socket.emit('terminal:killed', { terminalId });
    }
  });

  socket.on('disconnect', () => {
    detachSocketFromShared(socket);
    killAllSessions(socket);
  });
}

module.exports = { registerTerminalHandlers, prepareWorkspace, writeWorkspaceTree };
