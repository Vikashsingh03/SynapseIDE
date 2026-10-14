/**
 * CDP debug bridge — spawns `node --inspect-brk` on a workspace file and
 * talks the Chrome DevTools Protocol (Debugger + Runtime domains) over a
 * plain `ws` WebSocket. One DebugSession = one child process.
 *
 * Events pushed out via the onEvent callback: { kind, ...payload }
 *   'started'     { filePath, breakpoints }
 *   'output'      { type: 'stdout'|'stderr'|'console'|'system', text }
 *   'paused'      { reason, callFrames: [{ functionName, line, column, callFrameId, variables }] }
 *                 variables (name/value/type) are fetched for the TOP frame only.
 *   'resumed'     {}
 *   'terminated'  { code }
 *   'error'       { message }
 */
const { spawn } = require('child_process');
const net = require('net');
const http = require('http');
const path = require('path');
const { pathToFileURL } = require('url');
const WebSocket = require('ws');

const JSON_LIST_TIMEOUT_MS = 8000;
const JSON_LIST_POLL_MS = 100;
const MAX_VARIABLES = 60;

function previewValue(v) {
  if (!v || typeof v !== 'object') return String(v);
  if ('value' in v && v.value !== undefined && v.type !== 'object') {
    return String(v.value).slice(0, 200);
  }
  return String(v.description || v.className || v.subtype || v.type || 'object').slice(0, 200);
}

class DebugSession {
  constructor() {
    this.child = null;
    this.ws = null;
    this.msgId = 1;
    this.pending = new Map();
    this.scripts = new Map(); // scriptId -> url
    this.targetUrl = null;
    this.targetScriptId = null;
    this.breakpointIds = [];
    this.started = false;
    this.stopped = false;
    this.onEvent = null;
    this.cwd = null;
    this.safeRel = null;
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

  // ─── Wait for the inspector HTTP endpoint to list the debug target ──────────
  async fetchTargetList(port) {
    const deadline = Date.now() + JSON_LIST_TIMEOUT_MS;
    while (Date.now() < deadline) {
      try {
        const list = await new Promise((resolve, reject) => {
          const req = http.get(
            { host: '127.0.0.1', port, path: '/json/list', timeout: 1500 },
            (res) => {
              let body = '';
              res.on('data', (c) => (body += c));
              res.on('end', () => {
                try {
                  resolve(JSON.parse(body));
                } catch (e) {
                  reject(e);
                }
              });
            }
          );
          req.on('error', reject);
          req.on('timeout', () => {
            req.destroy();
            reject(new Error('timeout'));
          });
        });
        const target = (Array.isArray(list) ? list : []).find(
          (t) => t.webSocketDebuggerUrl
        );
        if (target) return target;
      } catch {}
      await new Promise((r) => setTimeout(r, JSON_LIST_POLL_MS));
    }
    throw new Error('Timed out waiting for the Node inspector endpoint.');
  }

  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        reject(new Error('Debugger connection is not open.'));
        return;
      }
      const id = this.msgId++;
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }), (err) => {
        if (err) {
          this.pending.delete(id);
          reject(err);
        }
      });
    });
  }

  async handlePaused(params) {
    const frames = (params.callFrames || []).map((f, i) => ({
      functionName: f.functionName || '(anonymous)',
      line: (f.location?.lineNumber ?? 0) + 1,
      column: f.location?.columnNumber ?? 0,
      callFrameId: f.callFrameId,
      variables: i === 0 ? [] : undefined,
    }));

    // Top frame: fetch 'local' scope variables (fall back to 'closure').
    try {
      const top = (params.callFrames || [])[0];
      const chain = top?.scopeChain || [];
      const scope =
        chain.find((s) => s.type === 'local') ||
        chain.find((s) => s.type === 'closure');
      const objectId = scope?.object?.objectId;
      if (objectId) {
        const res = await this.send('Runtime.getProperties', {
          objectId,
          ownProperties: true,
        });
        const props = (res.result || []).slice(0, MAX_VARIABLES);
        frames[0].variables = props.map((p) => ({
          name: p.name,
          value: previewValue(p.value),
          type: p.value?.subtype || p.value?.type || typeof p.value,
        }));
      }
    } catch (err) {
      // Variables are best-effort — never break the pause event.
    }

    this.emit('paused', { reason: params.reason || 'other', callFrames: frames });
  }

  handleMessage(raw) {
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }
    if (msg.id !== undefined && this.pending.has(msg.id)) {
      const { resolve, reject } = this.pending.get(msg.id);
      this.pending.delete(msg.id);
      if (msg.error) reject(new Error(msg.error.message || 'CDP error'));
      else resolve(msg.result || {});
      return;
    }
    if (!msg.method) return;
    switch (msg.method) {
      case 'Debugger.scriptParsed':
        this.onScriptParsed(msg.params || {});
        break;
      case 'Debugger.paused':
        this.handlePaused(msg.params || {});
        break;
      case 'Debugger.resumed':
        this.emit('resumed');
        break;
      case 'Runtime.consoleAPICalled': {
        const args = (msg.params?.args || []).map(previewValue);
        this.emit('output', {
          type: 'console',
          text: args.join(' '),
        });
        break;
      }
      case 'Runtime.exceptionThrown':
        this.emit('output', {
          type: 'console',
          text: `Uncaught: ${msg.params?.exceptionDetails?.text || 'exception'}`,
        });
        break;
      default:
        break;
    }
  }

  onScriptParsed(params) {
    if (!params.scriptId) return;
    const url = String(params.url || '');
    this.scripts.set(params.scriptId, url);
    // Match the file being debugged by URL suffix (handles file:// URLs).
    if (this.targetUrl && url.endsWith(this.targetUrl)) {
      this.targetScriptId = params.scriptId;
    }
  }

  async setBreakpointsInternal(lines) {
    // Remove previous breakpoints first.
    for (const id of this.breakpointIds) {
      try {
        await this.send('Debugger.removeBreakpoint', { breakpointId: id });
      } catch {}
    }
    this.breakpointIds = [];
    const applied = [];
    // Prefer exact scriptId-based breakpoints (no URL matching involved).
    // Fallback: the exact file:// URL of the target.
    const useScriptId = this.targetScriptId && this.scripts.has(this.targetScriptId);
    const fileUrl = (() => {
      try {
        return pathToFileURL(path.resolve(this.cwd, this.safeRel)).href;
      } catch {
        return null;
      }
    })();
    for (const line of lines) {
      const lineNumber = Math.max(0, line - 1);
      try {
        let res;
        if (useScriptId) {
          res = await this.send('Debugger.setBreakpoint', {
            location: { scriptId: this.targetScriptId, lineNumber },
          });
        } else if (fileUrl) {
          res = await this.send('Debugger.setBreakpointByUrl', {
            url: fileUrl,
            lineNumber,
          });
        } else {
          continue;
        }
        if (res.breakpointId) this.breakpointIds.push(res.breakpointId);
        applied.push(line);
      } catch {}
    }
    return applied;
  }

  async start({ cwd, relFile, breakpoints = [], onEvent } = {}) {
    if (this.started) throw new Error('Debug session already started.');
    this.started = true;
    this.onEvent = onEvent || null;

    const safeRel = String(relFile || '');
    this.cwd = cwd;
    this.safeRel = safeRel;
    // URL suffix used to match Debugger.scriptParsed events.
    this.targetUrl = '/' + safeRel.split(path.sep).join('/');
    const lines = (Array.isArray(breakpoints) ? breakpoints : [])
      .filter((n) => Number.isInteger(n) && n > 0)
      .slice(0, 50);

    const port = await this.allocatePort();

    return new Promise((resolve, reject) => {
      const child = spawn(
        process.execPath,
        [`--inspect-brk=127.0.0.1:${port}`, safeRel],
        { cwd }
      );
      this.child = child;

      child.on('error', (err) => {
        this.emit('error', { message: `Could not start node: ${err.message}` });
        reject(err);
      });

      child.stdout?.on('data', (d) =>
        this.emit('output', { type: 'stdout', text: String(d) })
      );
      child.stderr?.on('data', (d) => {
        const text = String(d);
        // The inspector prints its banner to stderr — mark it as system info.
        if (/Debugger (listening|attached)/i.test(text)) {
          this.emit('output', { type: 'system', text: text.trim() });
        } else if (/Waiting for the debugger to disconnect/.test(text)) {
          // The program has run to completion; node keeps the process alive
          // until the inspector disconnects. Tear down so 'terminated' fires
          // instead of hanging the session forever.
          this.emit('output', { type: 'system', text: 'Program finished — disconnecting debugger.' });
          setTimeout(() => {
            if (this.stopped) return;
            this.stop();
            this.emit('terminated', { code: 0 });
          }, 300);
        } else {
          this.emit('output', { type: 'stderr', text });
        }
      });

      child.on('exit', (code) => {
        if (!this.stopped) {
          this.emit('terminated', { code: code ?? null });
        }
        this.cleanup();
      });

      (async () => {
        try {
          const target = await this.fetchTargetList(port);
          const ws = new WebSocket(target.webSocketDebuggerUrl, {
            maxPayload: 16 * 1024 * 1024,
          });
          this.ws = ws;

          await new Promise((res, rej) => {
            ws.on('open', res);
            ws.on('error', rej);
          });

          ws.on('message', (data) => this.handleMessage(String(data)));
          ws.on('close', () => {
            for (const [, p] of this.pending) p.reject(new Error('Debugger socket closed.'));
            this.pending.clear();
            if (!this.stopped && this.child) {
              this.emit('error', { message: 'Debugger connection closed.' });
            }
          });

          await this.send('Debugger.enable');
          await this.send('Runtime.enable');
          try {
            await this.send('Log.enable');
          } catch {}

          // Start execution: --inspect-brk holds at script start, so the
          // target script parses now and scriptParsed arrives (that's what
          // lets us bind breakpoints by exact scriptId).
          await this.send('Runtime.runIfWaitingForDebugger');

          const deadline = Date.now() + 3000;
          while (!this.targetScriptId && Date.now() < deadline) {
            await new Promise((r) => setTimeout(r, 50));
          }

          const applied = await this.setBreakpointsInternal(lines);
          this.emit('started', { filePath: safeRel, breakpoints: applied });
          resolve(this);
        } catch (err) {
          this.emit('error', { message: err.message });
          try {
            child.kill('SIGKILL');
          } catch {}
          reject(err);
        }
      })();
    });
  }

  async setBreakpoints(lines) {
    const clean = (Array.isArray(lines) ? lines : [])
      .filter((n) => Number.isInteger(n) && n > 0)
      .slice(0, 50);
    const applied = await this.setBreakpointsInternal(clean);
    this.emit('output', {
      type: 'system',
      text: `Breakpoints updated: ${applied.length ? applied.join(', ') : 'none'}`,
    });
    return applied;
  }

  async resume() {
    await this.send('Debugger.resume');
  }
  async stepOver() {
    await this.send('Debugger.stepOver');
  }
  async stepInto() {
    await this.send('Debugger.stepInto');
  }
  async stepOut() {
    await this.send('Debugger.stepOut');
  }

  stop() {
    this.stopped = true;
    try {
      this.child?.kill('SIGKILL');
    } catch {}
    this.cleanup();
  }

  cleanup() {
    for (const [, p] of this.pending) {
      try {
        p.reject(new Error('Debug session ended.'));
      } catch {}
    }
    this.pending.clear();
    try {
      this.ws?.close();
    } catch {}
    this.ws = null;
  }
}

module.exports = { DebugSession };
