import { useState, useEffect, useMemo, useRef } from 'react';
import {
  X,
  Play,
  Bug,
  TerminalSquare,
  Square,
  StepForward,
  ArrowDownRight,
  ArrowUpRight,
  FileCode2,
} from 'lucide-react';
import { useFiles } from '../contexts/FileContext';
import { createCollaborationSocket } from '../services/socket';
import { getBreakpoints, subscribe as subscribeBreakpoints } from '../debug/breakpointsStore';
import { findLaunchFile, parseLaunchConfig, relPathOf } from '../utils/launchConfig';

const RUNNABLE = new Set(['js', 'mjs', 'cjs', 'py']);
const VISUAL_EXTS = new Set(['js', 'mjs', 'cjs', 'py']);
const PREFS_KEY = 'synapse-debug-prefs';

function extOf(name) {
  const i = name.lastIndexOf('.');
  return i > 0 ? name.slice(i + 1).toLowerCase() : '';
}

function runtimeFor(ext) {
  if (ext === 'py') return 'Python';
  return 'Node'; 
}

function loadPrefs() {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return { args: '', debug: false };
    const p = JSON.parse(raw);
    return { args: typeof p.args === 'string' ? p.args : '', debug: p.debug === true };
  } catch {
    return { args: '', debug: false };
  }
}










function VisualDebug({ jsFiles, files, forcedFileId }) {
  const { activeFileId } = useFiles();
  const [fileId, setFileId] = useState(
    () => (jsFiles.find((r) => r.id === activeFileId) || jsFiles[0] || null)?.id ?? null
  );
  const [bps, setBps] = useState([]);
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState('idle'); 
  const [frames, setFrames] = useState([]);
  const [variables, setVariables] = useState([]);
  const [consoleLines, setConsoleLines] = useState([]);
  const socketRef = useRef(null);
  const runningRef = useRef(false);
  const consoleRef = useRef(null);
  const relRef = useRef(null);

  const selected = jsFiles.find((r) => r.id === fileId) || null;
  const rel = selected?.rel || null;

  
  useEffect(() => {
    if (forcedFileId && jsFiles.some((r) => r.id === forcedFileId)) {
      setFileId(forcedFileId);
    }
  }, [forcedFileId, jsFiles]);

  
  useEffect(() => {
    if (!rel) {
      setBps([]);
      return;
    }
    setBps(getBreakpoints(rel));
    const off = subscribeBreakpoints(() => setBps(getBreakpoints(rel)));
    return off;
  }, [rel]);

  useEffect(() => {
    relRef.current = rel;
  }, [rel]);

  const pushLine = (type, text) =>
    setConsoleLines((prev) => [...prev.slice(-500), { type, text }]);

  const clearExecLine = () => {
    try {
      window.dispatchEvent(
        new CustomEvent('synapse:debug-line', { detail: { relPath: relRef.current, line: null } })
      );
    } catch {}
  };

  const sendCommand = (command) => {
    try {
      socketRef.current?.emit('debug:command', { command });
    } catch {}
  };

  
  useEffect(() => {
    const socket = createCollaborationSocket();
    socketRef.current = socket;
    socket.on('debug:event', (evt) => {
      if (!evt) return;
      switch (evt.kind) {
        case 'output':
          pushLine(evt.type, evt.text);
          break;
        case 'started':
          setStatus('running');
          pushLine(
            'system',
            `Debugger attached — breakpoints at ${(evt.breakpoints || []).length ? evt.breakpoints.join(', ') : 'none'}`
          );
          break;
        case 'paused': {
          setStatus('paused');
          const list = evt.callFrames || [];
          const top = list[0];
          setFrames(list);
          setVariables(top?.variables || []);
          try {
            window.dispatchEvent(
              new CustomEvent('synapse:debug-line', {
                detail: { relPath: relRef.current, line: top?.line ?? null },
              })
            );
          } catch {}
          break;
        }
        case 'resumed':
          setStatus('running');
          setFrames([]);
          setVariables([]);
          clearExecLine();
          break;
        case 'terminated':
          setRunning(false);
          runningRef.current = false;
          setStatus('stopped');
          setFrames([]);
          setVariables([]);
          clearExecLine();
          pushLine('system', `Process exited${evt.code != null ? ` (code ${evt.code})` : ''}.`);
          break;
        case 'error':
          pushLine('system', `Error: ${evt.message}`);
          break;
        default:
          break;
      }
    });
    socket.connect();
    return () => {
      try {
        socket.emit('debug:command', { command: 'stop' });
      } catch {}
      try {
        socket.disconnect();
      } catch {}
      socketRef.current = null;
      try {
        window.dispatchEvent(
          new CustomEvent('synapse:debug-line', { detail: { relPath: relRef.current, line: null } })
        );
      } catch {}
    };
    
  }, []);

  
  useEffect(() => {
    if (!runningRef.current || !socketRef.current) return;
    try {
      socketRef.current.emit('debug:setBreakpoints', { breakpoints: bps });
    } catch {}
  }, [bps]);

  useEffect(() => {
    const el = consoleRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [consoleLines]);

  const start = () => {
    if (!selected || !socketRef.current) return;
    const roomMatch = window.location.pathname.match(/^\/room\/([A-Za-z0-9]{1,16})/);
    const roomId = roomMatch ? roomMatch[1] : undefined;
    socketRef.current.emit('debug:start', {
      roomId,
      filePath: rel,
      breakpoints: bps,
      files: (files || []).map((f) => ({
        id: f.id,
        name: f.name,
        type: f.type,
        parentId: f.parentId,
        content: f.content,
      })),
    });
    setRunning(true);
    runningRef.current = true;
    setStatus('running');
    setConsoleLines([]);
    setFrames([]);
    setVariables([]);
  };

  const stop = () => {
    sendCommand('stop');
    setRunning(false);
    runningRef.current = false;
    setStatus('stopped');
    setFrames([]);
    setVariables([]);
    clearExecLine();
    pushLine('system', 'Session stopped.');
  };

  const paused = status === 'paused';
  const isPy = /\.py$/.test(selected?.rel || '');
  const statusLabel =
    status === 'running'
      ? 'Running…'
      : paused
        ? 'Paused'
        : status === 'stopped'
          ? 'Stopped'
          : 'Idle';

  const lineColor = (type) =>
    type === 'stderr'
      ? 'text-red-400'
      : type === 'system'
        ? 'text-(--muted) italic'
        : type === 'console'
          ? 'text-(--blue)'
          : 'text-(--ink)';

  if (jsFiles.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-2 text-center py-10">
        <FileCode2 size={28} className="text-(--muted)" />
        <p className="text-[13px] font-bold text-(--ink)">Nothing debuggable yet</p>
        <p className="font-mono text-[11px] text-(--muted)">Create a .js or .py file to visually debug</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      { }
      <div>
        <label className="text-[11px] font-bold uppercase tracking-[0.08em] text-(--muted)">
          File to debug
        </label>
        <select
          value={fileId || ''}
          onChange={(e) => setFileId(e.target.value || null)}
          disabled={running}
          className="mt-1.5 w-full h-9 px-2.5 rounded-md border border-(--line) bg-(--paper) text-[13px] text-(--ink) font-mono outline-none focus:border-(--blue)/60 transition-colors cursor-pointer disabled:opacity-50"
        >
          {jsFiles.map((r) => (
            <option key={r.id} value={r.id}>
              {r.rel}
            </option>
          ))}
        </select>
        {selected && (
          <span className="mt-1.5 inline-flex items-center px-2.5 py-1 rounded-full border text-[11px] font-bold bg-(--ink)/5 text-(--ink) border-(--line)">
            {isPy ? 'Python (debugpy)' : 'Node (CDP)'}
          </span>
        )}
      </div>

      { }
      <div className="rounded-lg border border-(--line) bg-(--paper) p-3">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-red-400 inline-block" />
          <span className="text-[12px] font-bold text-(--ink)">
            {bps.length === 0 ? 'No breakpoints' : `${bps.length} breakpoint${bps.length > 1 ? 's' : ''}`}
          </span>
          {bps.length > 0 && (
            <span className="font-mono text-[11px] text-(--muted)">lines {bps.join(', ')}</span>
          )}
        </div>
        <p className="font-mono text-[10.5px] text-(--muted) mt-1.5">
          Click the editor&apos;s left gutter to toggle a red breakpoint dot — they apply on launch,
          and can be changed live while paused or running.
        </p>
      </div>

      { }
      {!running ? (
        <button
          onClick={start}
          disabled={!selected}
          className="h-10 rounded-lg font-extrabold text-[13px] flex items-center justify-center gap-2 bg-(--ink) text-(--paper) hover:opacity-90 active:scale-[0.99] transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Bug size={15} />
          Start Visual Debug
        </button>
      ) : (
        <button
          onClick={stop}
          className="h-10 rounded-lg font-extrabold text-[13px] flex items-center justify-center gap-2 border border-red-400/50 text-red-400 hover:bg-red-400/10 active:scale-[0.99] transition-all cursor-pointer"
        >
          <Square size={15} />
          Stop Session
        </button>
      )}

      {running && (
        <>
          { }
          <div className="flex items-center gap-2">
            <span
              className={`w-2 h-2 rounded-full ${paused ? 'bg-yellow-400' : 'bg-emerald-400'} ${paused ? '' : 'animate-pulse'}`}
            />
            <span className="text-[12px] font-bold text-(--ink)">{statusLabel}</span>
            {paused && frames[0] && (
              <span className="font-mono text-[11px] text-(--muted)">
                at line {frames[0].line} of {selected?.name}
              </span>
            )}
          </div>

          { }
          <div className="grid grid-cols-4 gap-1.5">
            <button
              onClick={() => sendCommand('resume')}
              disabled={!paused}
              title="Continue (resume)"
              className="h-9 rounded-md border border-(--line) bg-(--paper) text-[11px] font-bold text-(--ink) flex items-center justify-center gap-1.5 hover:border-(--blue)/50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              <Play size={13} /> Continue
            </button>
            <button
              onClick={() => sendCommand('stepOver')}
              disabled={!paused}
              title="Step over"
              className="h-9 rounded-md border border-(--line) bg-(--paper) text-[11px] font-bold text-(--ink) flex items-center justify-center gap-1.5 hover:border-(--blue)/50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              <StepForward size={13} /> Over
            </button>
            <button
              onClick={() => sendCommand('stepInto')}
              disabled={!paused}
              title="Step into"
              className="h-9 rounded-md border border-(--line) bg-(--paper) text-[11px] font-bold text-(--ink) flex items-center justify-center gap-1.5 hover:border-(--blue)/50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              <ArrowDownRight size={13} /> Into
            </button>
            <button
              onClick={() => sendCommand('stepOut')}
              disabled={!paused}
              title="Step out"
              className="h-9 rounded-md border border-(--line) bg-(--paper) text-[11px] font-bold text-(--ink) flex items-center justify-center gap-1.5 hover:border-(--blue)/50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              <ArrowUpRight size={13} /> Out
            </button>
          </div>

          { }
          <div>
            <label className="text-[11px] font-bold uppercase tracking-[0.08em] text-(--muted)">
              Call stack
            </label>
            <div className="mt-1.5 rounded-lg border border-(--line) bg-(--paper) max-h-36 overflow-y-auto custom-scrollbar">
              {frames.length === 0 ? (
                <p className="font-mono text-[11px] text-(--muted) p-2.5">
                  {paused ? 'No frames.' : 'Pause execution to inspect the stack.'}
                </p>
              ) : (
                frames.map((f, i) => (
                  <div
                    key={`${f.callFrameId}-${i}`}
                    className={`flex items-center gap-2 px-2.5 py-1.5 ${i > 0 ? 'border-t border-(--line)' : ''}`}
                  >
                    {i === 0 && <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 shrink-0" />}
                    <span className="font-mono text-[12px] text-(--ink) truncate">{f.functionName}</span>
                    <span className="font-mono text-[11px] text-(--muted) ml-auto">:{f.line}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          { }
          <div>
            <label className="text-[11px] font-bold uppercase tracking-[0.08em] text-(--muted)">
              Variables — top frame
            </label>
            <div className="mt-1.5 rounded-lg border border-(--line) bg-(--paper) max-h-44 overflow-y-auto custom-scrollbar">
              {variables.length === 0 ? (
                <p className="font-mono text-[11px] text-(--muted) p-2.5">
                  {paused ? 'No local variables.' : 'Pause execution to inspect variables.'}
                </p>
              ) : (
                variables.map((v) => (
                  <div
                    key={v.name}
                    className="flex items-baseline gap-2 px-2.5 py-1 border-t first:border-t-0 border-(--line)"
                  >
                    <span className="font-mono text-[12px] text-(--blue) shrink-0">{v.name}</span>
                    <span className="font-mono text-[11px] text-(--muted) truncate" title={v.value}>
                      {v.value}
                    </span>
                    <span className="font-mono text-[10px] text-(--muted) ml-auto shrink-0">{v.type}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}

      { }
      <div>
        <label className="text-[11px] font-bold uppercase tracking-[0.08em] text-(--muted)">
          Debug console
        </label>
        <div
          ref={consoleRef}
          className="mt-1.5 rounded-lg border border-(--line) bg-[#0A0E17] p-2.5 h-44 overflow-y-auto custom-scrollbar font-mono text-[11.5px] leading-relaxed whitespace-pre-wrap break-words"
        >
          {consoleLines.length === 0 ? (
            <span className="text-(--muted)">stdout, stderr and console output appear here.</span>
          ) : (
            consoleLines.map((l, i) => (
              <div key={i} className={lineColor(l.type)}>
                {l.text}
              </div>
            ))
          )}
        </div>
      </div>

      { }
      <p className="font-mono text-[10.5px] text-(--muted)">
        Real Node.js inspector (node --inspect) or the Debug Adapter Protocol (debugpy — the same
        adapter VS Code uses for Python) under the hood — the yellow line in the editor is
        where execution is paused. Solo runs your current files; room runs use the room&apos;s synced
        files. Node must be installed on the host; Python debugging needs debugpy on this machine
        (one-time): <span className="text-(--ink)">pip install debugpy</span>.
      </p>
    </div>
  );
}

export default function DebugPanel({ onClose }) {
  const { files, activeFileId } = useFiles();

  
  const runnable = useMemo(() => {
    const byId = new Map(files.map((f) => [f.id, f]));
    return files
      .filter((f) => f.type === 'file' && RUNNABLE.has(extOf(f.name)))
      .map((f) => {
        const parts = [f.name];
        const seen = new Set([f.id]);
        let cur = f;
        while (cur.parentId && byId.has(cur.parentId) && !seen.has(cur.parentId)) {
          seen.add(cur.parentId);
          cur = byId.get(cur.parentId);
          parts.unshift(cur.name);
        }
        return { id: f.id, name: f.name, rel: parts.join('/'), ext: extOf(f.name) };
      });
  }, [files]);

  const [prefs, setPrefs] = useState(loadPrefs);
  const [args, setArgs] = useState(prefs.args);
  const [debug, setDebug] = useState(prefs.debug);
  const [status, setStatus] = useState('');
  const [fileId, setFileId] = useState(null);
  const [mode, setMode] = useState('terminal'); 
  const [configName, setConfigName] = useState(''); 
  const [programMissing, setProgramMissing] = useState(false);

  
  const launchConfigs = useMemo(() => {
    const lf = findLaunchFile(files);
    if (!lf) return { rel: null, configs: [] };
    const list = parseLaunchConfig(lf.content || '').map((c) => {
      let m = runnable.find((r) => r.rel === c.program);
      if (!m) {
        const tail = '/' + c.program;
        const base = c.program.split('/').pop();
        const cand = runnable.filter((r) => r.rel.endsWith(tail) || r.rel === base);
        if (cand.length === 1) m = cand[0];
      }
      return { ...c, matchedId: m?.id ?? null };
    });
    return { rel: relPathOf(lf, files), configs: list };
  }, [files, runnable]);

  const selectedConfig = launchConfigs.configs.find((c) => c.name === configName) || null;

  const applyConfig = (name) => {
    setConfigName(name);
    const cfg = launchConfigs.configs.find((c) => c.name === name) || null;
    if (!cfg) {
      setProgramMissing(false);
      return;
    }
    setProgramMissing(!cfg.matchedId);
    if (cfg.matchedId) {
      setFileId(cfg.matchedId);
      setArgs(cfg.args.join(' '));
    }
  };

  
  useEffect(() => {
    const active = runnable.find((r) => r.id === activeFileId);
    setFileId((active || runnable[0] || null)?.id ?? null);
  }, [runnable, activeFileId]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const selected = runnable.find((r) => r.id === fileId) || null;

  const launch = () => {
    if (!selected) return;
    const cleanArgs = args.trim();
    const quoted = `"${selected.rel}"`;
    let command;
    if (selected.ext === 'py') {
      command = debug ? `python -m pdb ${quoted}` : `python ${quoted}`;
    } else {
      command = debug ? `node --inspect=9229 ${quoted}` : `node ${quoted}`;
    }
    if (cleanArgs) command += ` ${cleanArgs}`;
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify({ args, debug }));
    } catch {}
    window.dispatchEvent(new CustomEvent('synapse:terminal-run', { detail: { command } }));
    setStatus(`Sent "${selected.name}" to the terminal — watch it run below.`);
    setTimeout(() => setStatus(''), 4000);
  };

  const toggleChip = debug
    ? 'bg-(--blue)/15 text-(--blue) border-(--blue)/40'
    : 'text-(--muted) border-(--line) hover:text-(--ink)';

  return (
    <div className="fixed inset-y-0 right-0 w-[440px] max-w-[92vw] z-[70] bg-(--paper-2) border-l border-(--line) flex flex-col shadow-[0_0_48px_rgba(0,0,0,0.45)] animate-fade-in">
      { }
      <div className="px-4 py-3 flex items-center gap-2.5 shrink-0 border-b border-(--line)">
        <span className="w-8 h-8 rounded-md border border-(--line) flex items-center justify-center text-(--blue)">
          <Bug size={16} />
        </span>
        <div className="flex flex-col min-w-0">
          <span className="text-[13px] font-extrabold text-(--ink)">Run and Debug</span>
          <span className="font-mono text-[10px] text-(--muted)">launch files in the terminal — breakpoints included</span>
        </div>
        <button
          onClick={onClose}
          className="ml-auto p-1.5 rounded-md text-(--muted) hover:text-(--red) hover:bg-(--ink)/5 transition-colors cursor-pointer"
          title="Close"
        >
          <X size={16} />
        </button>
      </div>

      { }
      <div className="flex-1 overflow-y-auto custom-scrollbar px-4 py-4 flex flex-col gap-4">
        { }
        <div className="flex items-center gap-1 p-1 rounded-lg border border-(--line) bg-(--ink)/5 shrink-0">
          {[
            { id: 'terminal', label: 'Terminal' },
            { id: 'visual', label: 'Visual' },
          ].map((m) => (
            <button
              key={m.id}
              onClick={() => setMode(m.id)}
              className={`flex-1 h-8 rounded-md text-[12px] font-extrabold transition-colors cursor-pointer ${
                mode === m.id
                  ? 'bg-(--paper) text-(--ink) border border-(--line) shadow-sm'
                  : 'text-(--muted) hover:text-(--ink)'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        { }
        {launchConfigs.configs.length > 0 && (
          <div className="-mt-1">
            <label className="text-[11px] font-bold uppercase tracking-[0.08em] text-(--muted)">
              Configuration
            </label>
            <select
              value={configName}
              onChange={(e) => applyConfig(e.target.value)}
              title={launchConfigs.rel}
              className="mt-1.5 w-full h-9 px-2.5 rounded-md border border-(--line) bg-(--paper) text-[13px] text-(--ink) font-mono outline-none focus:border-(--blue)/60 transition-colors cursor-pointer"
            >
              <option value="">Manual — pick file and args below</option>
              {launchConfigs.configs.map((c) => (
                <option key={c.name} value={c.name}>
                  {c.name} ({c.type} · {c.program})
                </option>
              ))}
            </select>
            {programMissing && selectedConfig && (
              <p className="font-mono text-[10.5px] text-amber-400 mt-1.5">
                Program &quot;{selectedConfig.program}&quot; was not found in the project — select
                the file manually.
              </p>
            )}
          </div>
        )}

        {mode === 'visual' ? (
          <VisualDebug
            jsFiles={runnable.filter((r) => VISUAL_EXTS.has(r.ext))}
            files={files}
            forcedFileId={selectedConfig ? selectedConfig.matchedId : null}
          />
        ) : runnable.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-2 text-center">
            <TerminalSquare size={28} className="text-(--muted)" />
            <p className="text-[13px] font-bold text-(--ink)">Nothing runnable yet</p>
            <p className="font-mono text-[11px] text-(--muted)">Create a .js or .py file to run</p>
          </div>
        ) : (
          <>
            { }
            <div>
              <label className="text-[11px] font-bold uppercase tracking-[0.08em] text-(--muted)">File to run</label>
              <select
                value={fileId || ''}
                onChange={(e) => setFileId(e.target.value || null)}
                className="mt-1.5 w-full h-9 px-2.5 rounded-md border border-(--line) bg-(--paper) text-[13px] text-(--ink) font-mono outline-none focus:border-(--blue)/60 transition-colors cursor-pointer"
              >
                {runnable.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.rel}
                  </option>
                ))}
              </select>
            </div>

            { }
            <div className="flex items-center gap-2">
              {selected && (
                <span className="inline-flex items-center px-2.5 py-1 rounded-full border text-[11px] font-bold bg-(--ink)/5 text-(--ink) border-(--line)">
                  {runtimeFor(selected.ext)}
                </span>
              )}
              <button
                role="switch"
                aria-checked={debug}
                onClick={() => setDebug((d) => !d)}
                className={`ml-auto inline-flex items-center gap-2 px-2.5 py-1 rounded-full border text-[11px] font-bold transition-colors cursor-pointer ${toggleChip}`}
                title="Toggle debug mode"
              >
                <span className={`w-7 h-4 rounded-full relative transition-colors ${debug ? 'bg-(--blue)' : 'bg-(--ink)/15'}`}>
                  <span
                    className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${debug ? 'left-3.5' : 'left-0.5'}`}
                  />
                </span>
                Debug mode
              </button>
            </div>

            { }
            <div>
              <label className="text-[11px] font-bold uppercase tracking-[0.08em] text-(--muted)">Arguments</label>
              <input
                value={args}
                onChange={(e) => setArgs(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') launch();
                }}
                placeholder="command line arguments…"
                className="mt-1.5 w-full h-9 px-2.5 rounded-md border border-(--line) bg-(--paper) text-[13px] text-(--ink) font-mono outline-none focus:border-(--blue)/60 transition-colors placeholder:text-(--muted)"
              />
            </div>

            { }
            <button
              onClick={launch}
              disabled={!selected}
              className="h-10 rounded-lg font-extrabold text-[13px] flex items-center justify-center gap-2 bg-(--ink) text-(--paper) hover:opacity-90 active:scale-[0.99] transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {debug ? <Bug size={15} /> : <Play size={15} />}
              {debug ? 'Debug in Terminal' : 'Run in Terminal'}
            </button>
            {status && (
              <p className="font-mono text-[11px] text-emerald-500 -mt-2">{status}</p>
            )}

            { }
            {debug && selected && runtimeFor(selected.ext) === 'Node' && (
              <div className="rounded-lg border border-(--line) bg-(--paper) p-3">
                <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-(--muted) mb-2">Node debugging steps</p>
                <ol className="text-[12px] text-(--ink) flex flex-col gap-1.5 list-decimal list-inside">
                  <li>
                    Open <span className="font-mono text-(--blue)">chrome://inspect</span> in Chrome or Edge
                  </li>
                  <li>Open dedicated DevTools for Node</li>
                  <li>
                    Set breakpoints in Sources — files load from the server&apos;s workspace folder, matching the
                    path shown above
                  </li>
                </ol>
              </div>
            )}
            {debug && selected && runtimeFor(selected.ext) === 'Python' && (
              <div className="rounded-lg border border-(--line) bg-(--paper) p-3">
                <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-(--muted) mb-2">pdb cheat sheet</p>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    'n — next line',
                    's — step in',
                    'p <expr> — print',
                    'c — continue',
                    'b <line> — break',
                    'q — quit',
                  ].map((chip) => (
                    <span
                      key={chip}
                      className="font-mono text-[11px] px-2 py-1 rounded-md border border-(--line) bg-(--ink)/5 text-(--ink)"
                    >
                      {chip}
                    </span>
                  ))}
                </div>
              </div>
            )}

            { }
            <p className="font-mono text-[10.5px] text-(--muted) mt-auto pt-2">
              Commands run in the workspace folder of the room — Node and Python must be installed on the host.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

export function DebugHost() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener('synapse:open-debug', onOpen);
    return () => window.removeEventListener('synapse:open-debug', onOpen);
  }, []);

  if (!open) return null;
  return <DebugPanel onClose={() => setOpen(false)} />;
}
