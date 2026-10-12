/**
 * In-browser terminal manager (node-pty + Socket.IO).
 *
 * Each connected socket gets at most ONE pty session. The pty is killed
 * when the socket disconnects or when the client asks for a fresh one.
 *
 * Security notes:
 * - The pty runs as the server's OS user — only enable this on a trusted
 *   dev machine (localhost). Do NOT expose an unrestricted shell on a
 *   public server without a sandbox.
 * - Working directory is pinned to the server root; `cd` still works
 *   inside the shell but the process starts in a known place.
 */
const path = require('path');

let pty = null;
try {
  // Lazy so the server still boots when node-pty isn't installed.
  pty = require('node-pty');
} catch {
  pty = null;
}

// socket.id -> pty.Process
const sessions = new Map();

function getShell() {
  if (process.platform === 'win32') {
    return { file: 'powershell.exe', args: ['-NoLogo'] };
  }
  return { file: process.env.SHELL || '/bin/bash', args: ['--login'] };
}

function killSession(socket) {
  const proc = sessions.get(socket.id);
  if (proc) {
    try {
      proc.kill();
    } catch {}
    sessions.delete(socket.id);
  }
}

function createSession(io, socket) {
  if (!pty) {
    socket.emit('terminal:error', {
      message: "node-pty is not installed. Run: npm install node-pty (in server/) — on Windows it needs VS Build Tools.",
    });
    return;
  }

  // Kill any existing session for this socket (fresh terminal)
  killSession(socket);

  const { file, args } = getShell();
  let proc;
  try {
    proc = pty.spawn(file, args, {
      name: 'xterm-256color',
      cols: 80,
      rows: 24,
      cwd: path.join(__dirname, '..'),
      env: { ...process.env, TERM: 'xterm-256color' },
    });
  } catch (err) {
    socket.emit('terminal:error', { message: `Could not start terminal: ${err.message}` });
    return;
  }

  sessions.set(socket.id, proc);

  proc.onData((data) => {
    socket.emit('terminal:output', data);
  });

  proc.onExit(({ exitCode }) => {
    socket.emit('terminal:exit', { exitCode });
    sessions.delete(socket.id);
  });

  socket.emit('terminal:ready');
}

function registerTerminalHandlers(io, socket) {
  socket.on('terminal:create', () => createSession(io, socket));

  socket.on('terminal:input', (data) => {
    const proc = sessions.get(socket.id);
    if (proc) {
      try {
        proc.write(String(data || ''));
      } catch {}
    }
  });

  socket.on('terminal:resize', ({ cols, rows } = {}) => {
    const proc = sessions.get(socket.id);
    if (proc && cols > 0 && rows > 0) {
      try {
        proc.resize(Math.min(cols, 240), Math.min(rows, 80));
      } catch {}
    }
  });

  socket.on('terminal:kill', () => {
    killSession(socket);
    socket.emit('terminal:killed');
  });

  // Always clean up the pty when the socket goes away
  socket.on('disconnect', () => killSession(socket));
}

module.exports = { registerTerminalHandlers };
