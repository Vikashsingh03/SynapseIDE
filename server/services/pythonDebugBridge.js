/**
 * Python debug bridge — visually debugs .py files through the REAL Debug
 * Adapter Protocol (DAP) using debugpy — the same adapter VS Code uses.
 * One PythonDebugSession = one debugpy child process + one DAP TCP channel.
 *
 * Interface mirrors server/services/debugBridge.js (CDP) so both sessions
 * are interchangeable for server/socket/debugManager.js:
 *   start({ cwd, relFile, breakpoints, onEvent })
 *   resume() / stepOver() / stepInto() / stepOut()  (DAP continue/next/stepIn/stepOut)
 *   setBreakpoints(lines)
 *   stop()
 *
 * Events pushed out via the onEvent callback: { kind, ...payload }
 *   'started'     { filePath, breakpoints }
 *   'output'      { type: 'stdout'|'stderr'|'console'|'system', text }
 *   'paused'      { reason, callFrames: [{ functionName, line, column, variables }] }
 *                 variables (name/value/type) are fetched for the TOP frame only.
 *   'resumed'     {}
 *   'terminated'  { code }
 *   'error'       { message }
 *
 * The python command is overridable via SYNAPSE_PYTHON (default 'python3').
 */
const { spawn } = require('child_process');
const net = require('net');
const path = require('path');

const REQUEST_TIMEOUT_MS = 10000;
const CONNECT_TIMEOUT_MS = 8000;
const CONNECT_RETRY_MS = 100;
const MAX_VARIABLES = 60;

const DEBUGPY_MISSING_MESSAGE =
  'debugpy is not installed on the server machine. Run: pip install debugpy';

class PythonDebugSession {
  constructor() {
    this.child = null;
    this.dap = null; // net.Socket to debugpy's DAP channel
    this.seq = 1;
    this.pending = new Map(); // seq -> { resolve, reject, timer, command }
    this.buf = Buffer.alloc(0);
    this.onEvent = null;
    this.started = false;
    this.stopped = false;
    this.cwd = null;
    this.safeRel = null;
    this.absPath = null;
    this.threadId = null;
    this.pythonCmd = null;
    this.initializedSeen = false;
    // debugpy emits 'output' events in small fragments; coalesce consecutive
    // same-type chunks into whole lines before emitting to the client.
    this.outputBuf = { type: null, text: '' };
  }

  flushOutput() {
    const b = this.outputBuf;
    if (b.type && b.text) this.emit('output', { type: b.type, text: b.text });
    this.outputBuf = { type: null, text: '' };
  }

  emit(kind, payload = {}) {
    try {
      this.onEvent?.({ kind, ...payload });
    } catch {}
  }

  // ─── Port allocation: bind port 0, read it back, close ─────────────────────
  async allocatePort() {
    return new Promise((resolve, reject) => {
      const srv = net.createServer();
      srv.on('error', reject);
      srv.listen(0, '127.0.0.1', () => {
        const port = srv.address().port;
        srv.close(() => resolve(port));
      });
    });
  }

  // ─── Preflight: resolve a python command that has debugpy ──────────────────
  async preflight() {
    const override = process.env.SYNAPSE_PYTHON;
    const candidates = override ? [override] : ['python3', 'python'];
    for (const cmd of candidates) {
      const ok = await new Promise((resolve) => {
        let settled = false;
        const done = (v) => {
          if (!settled) {
            settled = true;
            resolve(v);
          }
        };
        let child;
        try {
          child = spawn(cmd, ['-c', 'import debugpy'], { stdio: 'ignore' });
        } catch {
          done(false);
          return;
        }
        const timer = setTimeout(() => {
          try {
            child.kill('SIGKILL');
          } catch {}
          done(false);
        }, 10000);
        child.on('error', () => {
          clearTimeout(timer);
          done(false);
        });
        child.on('exit', (code) => {
          clearTimeout(timer);
          done(code === 0);
        });
      });
      if (ok) {
        this.pythonCmd = cmd;
        return;
      }
    }
    throw new Error(DEBUGPY_MISSING_MESSAGE);
  }

  // ─── DAP framing: 'Content-Length: N\r\n\r\n' + JSON ─────────────────────────
  sendFrame(obj) {
    if (!this.dap || this.dap.destroyed) {
      throw new Error('Debug adapter connection is closed.');
    }
    const body = Buffer.from(JSON.stringify(obj), 'utf8');
    const header = Buffer.from(`Content-Length: ${body.length}\r\n\r\n`, 'utf8');
    this.dap.write(Buffer.concat([header, body]));
  }

  // Fire-and-forget request: sends the framed request without tracking a
  // response. Needed for 'attach' — the adapter only responds to it after
  // 'configurationDone' is processed, so awaiting it would hang.
  sendOnly(command, args) {
    if (!this.dap || this.dap.destroyed) {
      throw new Error('Debug adapter connection is closed.');
    }
    const seq = this.seq++;
    this.sendFrame(
      args === undefined
        ? { seq, type: 'request', command }
        : { seq, type: 'request', command, arguments: args }
    );
  }

  request(command, args) {
    return new Promise((resolve, reject) => {
      if (!this.dap || this.dap.destroyed) {
        reject(new Error('Debug adapter connection is closed.'));
        return;
      }
      const seq = this.seq++;
      const timer = setTimeout(() => {
        this.pending.delete(seq);
        reject(new Error(`Debug adapter request timed out (${command}).`));
      }, REQUEST_TIMEOUT_MS);
      this.pending.set(seq, { resolve, reject, timer, command });
      try {
        this.sendFrame(args === undefined ? { seq, type: 'request', command } : { seq, type: 'request', command, arguments: args });
      } catch (err) {
        clearTimeout(timer);
        this.pending.delete(seq);
        reject(err);
      }
    });
  }

  onData(chunk) {
    this.buf = Buffer.concat([this.buf, chunk]);
    // Reassemble complete frames from the buffer (handles partial frames).
    for (;;) {
      const headerEnd = this.buf.indexOf('\r\n\r\n');
      if (headerEnd === -1) return;
      const header = this.buf.slice(0, headerEnd).toString('utf8');
      const m = header.match(/Content-Length:\s*(\d+)/i);
      if (!m) {
        // Malformed frame — drop it and continue, never hang.
        this.buf = this.buf.slice(headerEnd + 4);
        continue;
      }
      const len = parseInt(m[1], 10);
      if (this.buf.length < headerEnd + 4 + len) return; // incomplete body — wait
      const body = this.buf.slice(headerEnd + 4, headerEnd + 4 + len);
      this.buf = this.buf.slice(headerEnd + 4 + len);
      let msg;
      try {
        msg = JSON.parse(body.toString('utf8'));
      } catch {
        continue; // skip malformed payload, keep parsing
      }
      this.handleMessage(msg);
    }
  }

  handleMessage(msg) {
    if (!msg || typeof msg !== 'object') return;
    if (msg.type === 'response') {
      const p = this.pending.get(msg.request_seq);
      if (p) {
        this.pending.delete(msg.request_seq);
        clearTimeout(p.timer);
        if (msg.success === false) {
          p.reject(new Error(msg.message || `Debug adapter error (${p.command}).`));
        } else {
          p.resolve(msg.body || {});
        }
      }
      return;
    }
    if (msg.type !== 'event') return;
    switch (msg.event) {
      case 'initialized':
        this.initializedSeen = true;
        break;
      case 'output':
        this.handleOutput(msg.body || {});
        break;
      case 'stopped':
        this.handleStopped(msg.body || {});
        break;
      case 'continued':
        this.emit('resumed');
        break;
      case 'exited':
        this.exitCode = msg.body?.exitCode;
        break;
      case 'terminated':
        this.flushOutput();
        if (!this.stopped) {
          this.stopped = true;
          this.emit('terminated', { code: this.exitCode ?? null });
        }
        this.cleanup();
        break;
      default:
        break; // thread/module/loadedSource events etc. are ignored
    }
  }

  handleOutput(body) {
    const text = String(body.output ?? '');
    if (!text) return;
    const cat = String(body.category || '');
    const type = cat === 'stdout' ? 'stdout' : cat === 'stderr' ? 'stderr' : 'console';
    const b = this.outputBuf;
    if (b.type === type && !b.text.endsWith('\n')) {
      b.text += text;
    } else {
      this.flushOutput();
      this.outputBuf = { type, text };
    }
    if (this.outputBuf.text.endsWith('\n')) this.flushOutput();
  }

  async handleStopped(body) {
    const reason = String(body.reason || 'breakpoint');
    const threadId = body.threadId;
    if (threadId != null) this.threadId = threadId;
    try {
      const thread = threadId ?? (await this.pickThreadId());
      if (thread == null) {
        this.emit('paused', { reason, callFrames: [] });
        return;
      }
      const trace = await this.request('stackTrace', {
        threadId: thread,
        startFrame: 0,
        levels: 10,
      });
      const rawFrames = trace.stackFrames || [];
      const callFrames = rawFrames.map((f, i) => ({
        functionName: f.name || '(anonymous)',
        line: f.line ?? 1,
        column: f.column ?? 0,
        frameId: f.id,
        variables: i === 0 ? [] : undefined,
      }));

      // Top frame variables: prefer the 'Locals' scope, else the first
      // non-'Globals' scope.
      try {
        const topId = rawFrames[0]?.id;
        if (topId != null) {
          const scopes = await this.request('scopes', { frameId: topId });
          const list = scopes.scopes || [];
          const scope =
            list.find((s) => s.name === 'Locals') ||
            list.find((s) => s.name !== 'Globals') ||
            list[0];
          if (scope?.variablesReference) {
            const vars = await this.request('variables', {
              variablesReference: scope.variablesReference,
              count: MAX_VARIABLES,
            });
            callFrames[0].variables = (vars.variables || [])
              .slice(0, MAX_VARIABLES)
              .map((v) => ({
                name: String(v.name ?? ''),
                value: String(v.value ?? '').slice(0, 200),
                type: v.type ? String(v.type) : 'unknown',
              }));
          }
        }
      } catch {
        // Variables are best-effort — never break the pause event.
      }

      this.emit('paused', { reason, callFrames });
    } catch (err) {
      this.emit('paused', { reason, callFrames: [] });
    }
  }

  async pickThreadId() {
    try {
      const t = await this.request('threads');
      const first = (t.threads || [])[0];
      return first ? first.id : null;
    } catch {
      return null;
    }
  }

  async ensureThreadId() {
    if (this.threadId != null) return this.threadId;
    this.threadId = await this.pickThreadId();
    return this.threadId;
  }

  // ─── Lifecycle ─────────────────────────────────────────────────────────────
  async start({ cwd, relFile, breakpoints = [], onEvent } = {}) {
    if (this.started) throw new Error('Debug session already started.');
    this.started = true;
    this.onEvent = onEvent || null;

    await this.preflight();

    const safeRel = String(relFile || '');
    this.cwd = cwd;
    this.safeRel = safeRel;
    this.absPath = path.resolve(cwd, safeRel);
    const lines = (Array.isArray(breakpoints) ? breakpoints : [])
      .filter((n) => Number.isInteger(n) && n > 0)
      .slice(0, 50);

    const port = await this.allocatePort();

    return new Promise((resolve, reject) => {
      let child;
      try {
        child = spawn(
          this.pythonCmd,
          [
            // -Xfrozen_modules=off: debugpy warns (and can miss breakpoints)
            // on Python 3.11+ when the stdlib runs as frozen modules.
            '-Xfrozen_modules=off',
            '-m',
            'debugpy',
            '--listen',
            `127.0.0.1:${port}`,
            '--wait-for-client',
            this.absPath,
          ],
          { cwd }
        );
      } catch (err) {
        this.emit('error', { message: `Could not start python: ${err.message}` });
        reject(err);
        return;
      }
      this.child = child;

      child.on('error', (err) => {
        this.emit('error', { message: `Could not start python: ${err.message}` });
        reject(err);
      });

      child.stdout?.on('data', (d) =>
        this.emit('output', { type: 'stdout', text: String(d) })
      );
      child.stderr?.on('data', (d) =>
        this.emit('output', { type: 'stderr', text: String(d) })
      );
      child.on('exit', (code) => {
        this.flushOutput();
        if (!this.stopped) {
          this.stopped = true;
          this.emit('terminated', { code: code ?? null });
        }
        this.cleanup();
      });

      const deadline = Date.now() + CONNECT_TIMEOUT_MS;
      const tryConnect = () => {
        if (this.stopped) return;
        const sock = net.connect({ host: '127.0.0.1', port }, () => {
          this.dap = sock;
          sock.on('data', (c) => this.onData(c));
          sock.on('error', (err) => {
            this.emit('error', { message: `Debug adapter error: ${err.message}` });
          });
          sock.on('close', () => {
            for (const [, p] of this.pending) {
              clearTimeout(p.timer);
              p.reject(new Error('Debug adapter connection closed.'));
            }
            this.pending.clear();
          });
          this.handshake(lines).then(
            () => resolve(this),
            (err) => {
              this.emit('error', { message: err.message });
              try {
                child.kill('SIGKILL');
              } catch {}
              reject(err);
            }
          );
        });
        sock.on('error', () => {
          sock.destroy();
          if (Date.now() < deadline) {
            setTimeout(tryConnect, CONNECT_RETRY_MS);
          } else {
            this.emit('error', { message: 'Timed out connecting to the debug adapter.' });
            try {
              child.kill('SIGKILL');
            } catch {}
            reject(new Error('Timed out connecting to the debug adapter.'));
          }
        });
      };
      tryConnect();
    });
  }

  async handshake(lines) {
    // The real DAP handshake for debugpy's CLI server mode
    // (`python -m debugpy --listen ... --wait-for-client`). This is the same
    // sequence VS Code performs: the adapter expects 'attach' (not 'launch')
    // and forwards it to the pydevd server. NOTE: attach arguments MUST be
    // non-empty — the adapter omits empty {} arguments from forwarded
    // requests, and pydevd rejects the request as malformed without them.
    await this.request('initialize', {
      clientID: 'synapse',
      adapterID: 'python',
      pathFormat: 'path',
      linesStartAt1: true,
      columnsStartAt1: true,
      supportsVariableType: true,
    });

    // 'attach' gets no immediate response — the adapter answers it only
    // after 'configurationDone'. Fire it and wait for 'initialized'.
    // redirectOutput: makes the debug server redirect the program's
    // stdout/stderr into DAP 'output' events (otherwise print() output
    // never reaches the debug console).
    this.sendOnly('attach', { justMyCode: true, redirectOutput: true });

    // Wait for the adapter's 'initialized' event before configuring.
    const deadline = Date.now() + 8000;
    while (!this.initializedSeen && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 50));
    }

    const applied = await this.applyBreakpoints(lines);

    await this.request('configurationDone');
    this.emit('started', { filePath: this.safeRel, breakpoints: applied });
  }

  async applyBreakpoints(lines) {
    const clean = (Array.isArray(lines) ? lines : [])
      .filter((n) => Number.isInteger(n) && n > 0)
      .slice(0, 50);
    const applied = [];
    try {
      const res = await this.request('setBreakpoints', {
        source: { path: this.absPath },
        breakpoints: clean.map((line) => ({ line })),
        sourceModified: false,
      });
      for (const b of res.breakpoints || []) {
        if (b.verified) applied.push(b.line);
      }
      // Fall back to the requested lines if the adapter didn't report back.
      if (!applied.length) applied.push(...clean);
    } catch {}
    return applied;
  }

  async setBreakpoints(lines) {
    const applied = await this.applyBreakpoints(lines);
    this.emit('output', {
      type: 'system',
      text: `Breakpoints updated: ${applied.length ? applied.join(', ') : 'none'}`,
    });
    return applied;
  }

  async resume() {
    const threadId = await this.ensureThreadId();
    await this.request('continue', { threadId });
  }
  async stepOver() {
    const threadId = await this.ensureThreadId();
    await this.request('next', { threadId });
  }
  async stepInto() {
    const threadId = await this.ensureThreadId();
    await this.request('stepIn', { threadId });
  }
  async stepOut() {
    const threadId = await this.ensureThreadId();
    await this.request('stepOut', { threadId });
  }

  stop() {
    this.stopped = true;
    this.flushOutput();
    try {
      this.child?.kill('SIGKILL');
    } catch {}
    this.cleanup();
  }

  cleanup() {
    for (const [, p] of this.pending) {
      clearTimeout(p.timer);
      try {
        p.reject(new Error('Debug session ended.'));
      } catch {}
    }
    this.pending.clear();
    try {
      this.dap?.destroy();
    } catch {}
    this.dap = null;
    this.buf = Buffer.alloc(0);
  }
}

module.exports = { PythonDebugSession };
