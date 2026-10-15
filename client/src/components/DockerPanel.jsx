import { useState, useEffect, useCallback } from 'react';
import { API_BASE } from '../config/apiConfig';
import { getToken } from '../services/authService';
import {
  Container,
  Play,
  Square,
  RotateCw,
  FileText,
  RefreshCw,
  X,
  Rocket,
} from 'lucide-react';

async function dockerFetch(path, opts = {}) {
  const token = getToken();
  const res = await fetch(`${API_BASE}/docker${path}`, {
    ...opts,
    headers: {
      ...(opts.method === 'POST' ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(opts.headers || {}),
    },
    ...(opts.body ? { body: JSON.stringify(opts.body) } : {}),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok && res.status !== 503) throw new Error(data.error || `Request failed (${res.status})`);
  return { status: res.status, data };
}

const STATE_STYLE = {
  running: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10',
  paused: 'text-amber-400 border-amber-500/30 bg-amber-500/10',
  exited: 'text-red-400 border-red-500/30 bg-red-500/10',
  dead: 'text-red-400 border-red-500/30 bg-red-500/10',
  created: 'text-sky-400 border-sky-500/30 bg-sky-500/10',
};

function stateStyle(state) {
  return STATE_STYLE[state] || STATE_STYLE.created;
}

function ActionBtn({ title, onClick, busy, children }) {
  return (
    <button
      onClick={onClick}
      disabled={busy}
      title={title}
      aria-label={title}
      className="p-1.5 rounded-md text-(--muted) hover:text-(--ink) hover:bg-(--ink)/5 border border-transparent hover:border-(--line) transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-default"
    >
      {children}
    </button>
  );
}

 
 
 

export default function DockerPanel({ onClose }) {
  const [status, setStatus] = useState(null); 
  const [containers, setContainers] = useState([]);
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null); 
  const [logsFor, setLogsFor] = useState(null);
  const [logs, setLogs] = useState('');
  const [logsBusy, setLogsBusy] = useState(false);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await dockerFetch('/status');
      setStatus(data);
      if (data.available) {
        const [ps, imgs] = await Promise.all([dockerFetch('/ps'), dockerFetch('/images')]);
        setContainers(ps.data.containers || []);
        setImages(imgs.data.images || []);
      }
    } catch (e) {
      setError(e.message || 'Failed to reach the server');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const runAction = async (id, action) => {
    setBusy(`${action}:${id}`);
    try {
      await dockerFetch('/action', { method: 'POST', body: { id, action } });
      const { data } = await dockerFetch('/ps');
      setContainers(data.containers || []);
    } catch (e) {
      setError(e.message || 'Action failed');
    } finally {
      setBusy(null);
    }
  };

  const toggleLogs = async (id) => {
    if (logsFor === id) {
      setLogsFor(null);
      return;
    }
    setLogsFor(id);
    setLogsBusy(true);
    try {
      const { data } = await dockerFetch(`/logs?id=${encodeURIComponent(id)}&tail=100`);
      setLogs(data.logs || '(no logs)');
    } catch (e) {
      setLogs(`Failed to fetch logs: ${e.message}`);
    } finally {
      setLogsBusy(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      { }
      <div className="flex items-center gap-2.5 px-5 py-4 border-b border-(--line) shrink-0">
        <span className="p-1.5 rounded-lg bg-(--blue)/10 border border-(--blue)/25 text-(--blue)">
          <Container size={16} />
        </span>
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-bold text-(--ink)">Docker</h2>
          <p className="text-[11px] text-(--muted)">
            {status?.available ? `daemon v${status.version || '?'}` : 'containers & images'}
          </p>
        </div>
        <button
          onClick={refresh}
          title="Refresh"
          aria-label="Refresh"
          className="p-1.5 rounded-md text-(--muted) hover:text-(--ink) hover:bg-(--ink)/5 transition-colors cursor-pointer"
        >
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
        </button>
        <button
          onClick={onClose}
          className="p-1.5 rounded-md text-(--muted) hover:text-(--ink) hover:bg-(--ink)/5 transition-colors cursor-pointer"
          aria-label="Close docker panel"
        >
          <X size={16} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
        {error && (
          <div className="text-[12px] text-red-400 bg-red-500/10 border border-red-500/30 rounded-xl px-3.5 py-2.5">
            {error}
          </div>
        )}

        {loading && !status ? (
          <p className="text-xs text-(--muted) px-1 py-6 text-center">
            Probing the Docker daemon…
          </p>
        ) : !status?.available ? (
           
          <div className="rounded-xl border border-(--line) bg-(--paper) p-6 text-center">
            <span className="inline-block p-3 rounded-xl bg-(--ink)/5 border border-(--line) text-(--muted) mb-3">
              <Container size={22} />
            </span>
            <p className="text-sm font-bold text-(--ink)">
              Docker not detected on this machine.
            </p>
            <p className="text-[12px] text-(--muted) mt-1.5 leading-relaxed">
              Install Docker Desktop and keep it running, then reopen.
            </p>
            <button
              onClick={() => {
                onClose();
                window.dispatchEvent(new Event('synapse:open-deploy'));
              }}
              className="mt-4 inline-flex items-center gap-1.5 text-[11px] font-bold px-3 py-2 rounded-lg bg-(--blue)/10 border border-(--blue)/30 text-(--blue) hover:bg-(--blue)/20 transition-colors cursor-pointer"
            >
              <Rocket size={12} />
              You can still generate a Dockerfile from the Deploy panel.
            </button>
          </div>
        ) : (
          <>
            { }
            <p className="text-[10px] font-bold uppercase tracking-wider text-(--muted) px-1">
              Containers ({containers.length})
            </p>
            {containers.length === 0 ? (
              <p className="text-[12px] text-(--muted) px-1 py-3">
                No containers found. Build one from your Dockerfile in a terminal.
              </p>
            ) : (
              containers.map((c) => {
                const isRunning = c.state === 'running';
                return (
                  <div
                    key={c.id}
                    className="rounded-xl border border-(--line) bg-(--paper) p-3.5"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[13px] font-bold text-(--ink) truncate">
                            {c.name || c.id.slice(0, 12)}
                          </span>
                          <span
                            className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${stateStyle(
                              c.state
                            )}`}
                          >
                            {c.state || c.status}
                          </span>
                        </div>
                        <p className="text-[11px] font-mono text-(--muted) truncate mt-1">
                          {c.image}
                          {c.ports ? ` · ${c.ports}` : ''}
                        </p>
                      </div>
                      <div className="flex items-center gap-0.5 shrink-0">
                        <ActionBtn
                          title={isRunning ? 'Already running' : 'Start'}
                          busy={!!busy}
                          onClick={() => !isRunning && runAction(c.id, 'start')}
                        >
                          <Play size={14} />
                        </ActionBtn>
                        <ActionBtn
                          title="Stop"
                          busy={!!busy}
                          onClick={() => runAction(c.id, 'stop')}
                        >
                          <Square size={14} />
                        </ActionBtn>
                        <ActionBtn
                          title="Restart"
                          busy={!!busy}
                          onClick={() => runAction(c.id, 'restart')}
                        >
                          <RotateCw size={14} />
                        </ActionBtn>
                        <ActionBtn
                          title="Logs"
                          busy={logsBusy && logsFor === c.id}
                          onClick={() => toggleLogs(c.id)}
                        >
                          <FileText size={14} />
                        </ActionBtn>
                      </div>
                    </div>
                    {logsFor === c.id && (
                      <pre className="mt-2.5 max-h-52 overflow-auto custom-scrollbar text-[11px] font-mono leading-relaxed bg-black/30 border border-(--line) rounded-lg p-3 text-(--ink)/85 whitespace-pre-wrap break-words">
                        {logsBusy ? 'Loading logs…' : logs}
                      </pre>
                    )}
                  </div>
                );
              })
            )}

            { }
            <p className="text-[10px] font-bold uppercase tracking-wider text-(--muted) px-1 pt-1">
              Images ({images.length})
            </p>
            {images.length === 0 ? (
              <p className="text-[12px] text-(--muted) px-1">No images found.</p>
            ) : (
              images.map((img, i) => (
                <div
                  key={`${img.repository}:${img.tag}:${i}`}
                  className="rounded-xl border border-(--line) bg-(--paper) px-3.5 py-2.5 flex items-center gap-2 min-w-0"
                >
                  <span className="text-[12px] font-mono text-(--ink) truncate flex-1 min-w-0">
                    {img.repository}:{img.tag}
                  </span>
                  <span className="text-[11px] font-mono text-(--muted) shrink-0">
                    {img.size}
                  </span>
                </div>
              ))
            )}
          </>
        )}
      </div>
    </div>
  );
}

 
 
 

export function DockerHost() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const doOpen = () => setOpen(true);
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('synapse:open-docker', doOpen);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('synapse:open-docker', doOpen);
      window.removeEventListener('keydown', onKey);
    };
  }, []);

  if (!open) return null;
  return (
    <div className="fixed inset-y-0 right-0 w-[600px] max-w-[94vw] z-[70] bg-(--paper-2) border-l border-(--line) flex flex-col shadow-[0_0_48px_rgba(0,0,0,0.45)] animate-fade-in">
      <DockerPanel onClose={() => setOpen(false)} />
    </div>
  );
}
