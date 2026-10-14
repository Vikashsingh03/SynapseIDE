/**
 * Visual debugger manager — one DebugSession per socket max.
 * Bridges server/services/debugBridge.js (CDP) to the client's
 * 'debug:*' Socket.IO events. Mirrors terminalManager.js structure.
 *
 * Client → server:
 *   'debug:start'         { roomId?, filePath, breakpoints, files } → emits 'debug:event'
 *   'debug:command'       { command: 'resume'|'stepOver'|'stepInto'|'stepOut'|'stop' }
 *   'debug:setBreakpoints'{ breakpoints }
 * Server → client: 'debug:event' { kind, ...payload }
 */
const path = require('path');
const { DebugSession } = require('../services/debugBridge');
const { prepareWorkspace } = require('./terminalManager');

// socket.id -> DebugSession (one active session max per socket)
const sessions = new Map();

function stopSession(socket) {
  const session = sessions.get(socket.id);
  if (!session) return;
  try {
    session.stop();
  } catch {}
  sessions.delete(socket.id);
}

// filePath must be a plain relative JS path inside the workspace.
function sanitizeFilePath(filePath) {
  const raw = String(filePath || '').replace(/\\/g, '/').trim();
  if (!raw || raw.length > 256) return null;
  if (raw.startsWith('/') || raw.includes('..')) return null;
  if (!/^[A-Za-z0-9_][A-Za-z0-9_./-]*\.(mjs|cjs|js)$/.test(raw)) return null;
  if (/[~^?*:|<>]/.test(raw)) return null;
  return raw;
}

async function startSession(socket, { roomId, filePath, breakpoints, files } = {}) {
  stopSession(socket);

  const safePath = sanitizeFilePath(filePath);
  if (!safePath) {
    socket.emit('debug:event', {
      kind: 'error',
      message: 'Invalid debug target. Pick a .js/.mjs/.cjs file in the workspace.',
    });
    return;
  }

  // prepareWorkspace: solo → writes client files to workspaces/solo-<userId>;
  // room → writes the room's DB files (same as terminal runs).
  const cwd =
    (await prepareWorkspace(roomId, files, socket.data.user?.userId)) ||
    path.join(__dirname, '..', '..');

  const session = new DebugSession();
  sessions.set(socket.id, session);
  session.onEvent = (evt) => {
    try {
      socket.emit('debug:event', evt);
    } catch {}
  };

  try {
    await session.start({ cwd, relFile: safePath, breakpoints, onEvent: session.onEvent });
  } catch (err) {
    socket.emit('debug:event', { kind: 'error', message: err.message });
    sessions.delete(socket.id);
    return;
  }

  // The target script may not have parsed yet when --inspect-brk fired
  // before any scriptParsed arrived; send the freshest breakpoint list again
  // once the session confirms the script — setBreakpoints is idempotent here.
  console.log('[debug] session started for', socket.id, 'file=' + safePath);
}

async function runCommand(socket, command) {
  const session = sessions.get(socket.id);
  if (!session) return;
  try {
    switch (command) {
      case 'resume':
        await session.resume();
        break;
      case 'stepOver':
        await session.stepOver();
        break;
      case 'stepInto':
        await session.stepInto();
        break;
      case 'stepOut':
        await session.stepOut();
        break;
      case 'stop':
        stopSession(socket);
        socket.emit('debug:event', { kind: 'terminated', code: null });
        break;
      default:
        break;
    }
  } catch (err) {
    socket.emit('debug:event', { kind: 'error', message: err.message });
  }
}

function registerDebugHandlers(io, socket) {
  console.log('[debug] handlers registered for', socket.id);

  socket.on('debug:start', (payload = {}) => startSession(socket, payload));

  socket.on('debug:command', ({ command } = {}) => runCommand(socket, command));

  socket.on('debug:setBreakpoints', async ({ breakpoints } = {}) => {
    const session = sessions.get(socket.id);
    if (!session) return;
    try {
      await session.setBreakpoints(breakpoints);
    } catch (err) {
      socket.emit('debug:event', { kind: 'error', message: err.message });
    }
  });

  // Always stop the debug session when the socket goes away
  socket.on('disconnect', () => stopSession(socket));
}

module.exports = { registerDebugHandlers };
