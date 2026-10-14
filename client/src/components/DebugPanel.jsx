import { useState, useEffect, useMemo } from 'react';
import { X, Play, Bug, TerminalSquare } from 'lucide-react';
import { useFiles } from '../contexts/FileContext';

const RUNNABLE = new Set(['js', 'mjs', 'cjs', 'py']);
const PREFS_KEY = 'synapse-debug-prefs';

function extOf(name) {
  const i = name.lastIndexOf('.');
  return i > 0 ? name.slice(i + 1).toLowerCase() : '';
}

function runtimeFor(ext) {
  if (ext === 'py') return 'Python';
  return 'Node'; // js | mjs | cjs
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

export default function DebugPanel({ onClose }) {
  const { files, activeFileId } = useFiles();

  // Reconstruct workspace-relative paths (folder chain + file name)
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

  // Default selection: active file if runnable, else the first runnable file
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
      {/* Header */}
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

      {/* Body */}
      <div className="flex-1 overflow-y-auto custom-scrollbar px-4 py-4 flex flex-col gap-4">
        {runnable.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-2 text-center">
            <TerminalSquare size={28} className="text-(--muted)" />
            <p className="text-[13px] font-bold text-(--ink)">Nothing runnable yet</p>
            <p className="font-mono text-[11px] text-(--muted)">Create a .js or .py file to run</p>
          </div>
        ) : (
          <>
            {/* File picker */}
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

            {/* Runtime chip + debug toggle */}
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

            {/* Arguments */}
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

            {/* Launch */}
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

            {/* Debug help cards */}
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

            {/* Honest note */}
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
