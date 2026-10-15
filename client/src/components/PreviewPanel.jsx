





import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Monitor, Play, Square, RotateCw, ExternalLink, X } from 'lucide-react';
import { useFiles } from '../contexts/FileContext';
import { relPathOf } from '../debug/breakpointsStore';
import { API_BASE } from '../config/apiConfig';
import { getToken } from '../services/authService';

function roomIdFromPath() {
  const m = window.location.pathname.match(/\/room\/([^/?#]+)/);
  return m ? m[1] : null;
}

function relOf(file, files) {
  return relPathOf(file, files) || file.name || '';
}

async function callPreview(endpoint, body) {
  const res = await fetch(`${API_BASE}/preview/${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getToken()}`,
    },
    body: JSON.stringify(body || {}),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Preview ${endpoint} failed (${res.status})`);
  return data;
}

function PreviewPanel({ onClose, roomId }) {
  const { files } = useFiles();
  const [state, setState] = useState('idle'); 
  const [server, setServer] = useState(null); 
  const [error, setError] = useState(null);
  const [syncedAt, setSyncedAt] = useState(0);
  const [iframeKey, setIframeKey] = useState(0);
  const runningRef = useRef(false);
  const syncTimer = useRef(null);

  const htmlFiles = useMemo(() => {
    return (files || [])
      .filter((f) => f.type !== 'folder' && /\.html?$/i.test(f.name || ''))
      .map((f) => relOf(f, files));
  }, [files]);

  const [path, setPath] = useState(() => {
    const list = (files || [])
      .filter((f) => f.type !== 'folder' && /\.html?$/i.test(f.name || ''))
      .map((f) => relOf(f, files));
    if (list.includes('index.html')) return 'index.html';
    return list[0] || '';
  });

  const start = useCallback(async () => {
    if (runningRef.current) return;
    runningRef.current = true;
    setState('starting');
    setError(null);
    try {
      const payload = (files || []).map((f) => ({
        id: f.id,
        name: f.name,
        type: f.type,
        parentId: f.parentId,
        content: f.content,
      }));
      const data = await callPreview('start', { roomId, files: payload });
      setServer({ port: data.port, url: data.url });
      setState('running');
    } catch (e) {
      setError(e.message || 'Could not start preview');
      setState('idle');
    } finally {
      runningRef.current = false;
    }
  }, [files, roomId]);

  const stop = useCallback(async () => {
    setState('idle');
    setServer(null);
    try {
      await callPreview('stop', { roomId });
    } catch {
       
    }
  }, [roomId]);

  
  useEffect(() => {
    start();
    return () => {
      stop();
    };
    
  }, []);

  
  useEffect(() => {
    if (state !== 'running') return;
    if (syncTimer.current) clearTimeout(syncTimer.current);
    syncTimer.current = setTimeout(async () => {
      try {
        const payload = (files || []).map((f) => ({
          id: f.id,
          name: f.name,
          type: f.type,
          parentId: f.parentId,
          content: f.content,
        }));
        await callPreview('sync', { roomId, files: payload });
        setSyncedAt(Date.now());
      } catch {
         
      }
    }, 900);
    return () => {
      if (syncTimer.current) clearTimeout(syncTimer.current);
    };
    
  }, [files, state, roomId]);

  const iframeSrc = state === 'running' && server ? `${server.url}/${path.replace(/^\/+/, '')}` : undefined;

  return (
    <div className="flex flex-col h-full">
      { }
      <div className="flex items-center gap-2 px-4 py-3 border-b border-(--line)">
        <Monitor size={17} className="text-(--ink)" />
        <h2 className="text-[13px] font-bold text-(--ink)">Live Preview</h2>
        <span
          className="w-2 h-2 rounded-full"
          style={{
            background:
              state === 'running' ? '#22c55e' : state === 'starting' ? '#f59e0b' : '#6b7280',
            boxShadow: state === 'running' ? '0 0 8px #22c55e88' : 'none',
          }}
          title={state}
        />
        {server && (
          <span className="font-mono text-[11px] text-(--muted) truncate">{server.url}</span>
        )}
        <div className="flex-1" />
        {syncedAt > 0 && state === 'running' && (
          <span key={syncedAt} className="text-[11px] text-emerald-400 font-mono animate-fade-in">
            Synced ✓
          </span>
        )}
        <button
          onClick={onClose}
          className="p-1.5 rounded-md text-(--muted) hover:text-(--ink) hover:bg-white/5 transition-colors"
          aria-label="Close preview"
        >
          <X size={15} />
        </button>
      </div>

      { }
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-(--line)">
        <input
          value={path}
          onChange={(e) => setPath(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && setIframeKey((k) => k + 1)}
          placeholder="index.html"
          spellCheck={false}
          className="flex-1 h-8 px-2.5 rounded-md border border-(--line) bg-(--paper) text-[12.5px] text-(--ink) font-mono outline-none focus:border-(--blue)/60 transition-colors"
        />
        <button
          onClick={() => setIframeKey((k) => k + 1)}
          title="Reload"
          className="p-2 rounded-md text-(--muted) hover:text-(--ink) hover:bg-white/5 transition-colors"
        >
          <RotateCw size={14} />
        </button>
        <button
          onClick={() => iframeSrc && window.open(iframeSrc, '_blank', 'noopener')}
          disabled={!iframeSrc}
          title="Open in new tab"
          className="p-2 rounded-md text-(--muted) hover:text-(--ink) hover:bg-white/5 transition-colors disabled:opacity-40"
        >
          <ExternalLink size={14} />
        </button>
        {state === 'running' ? (
          <button
            onClick={stop}
            title="Stop preview server"
            className="flex items-center gap-1.5 h-8 px-3 rounded-md text-[12px] font-bold bg-red-500/15 text-red-400 border border-red-500/30 hover:bg-red-500/25 transition-colors"
          >
            <Square size={12} /> Stop
          </button>
        ) : (
          <button
            onClick={start}
            disabled={state === 'starting'}
            title="Start preview server"
            className="flex items-center gap-1.5 h-8 px-3 rounded-md text-[12px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25 transition-colors disabled:opacity-50"
          >
            <Play size={12} /> {state === 'starting' ? 'Starting…' : 'Start'}
          </button>
        )}
      </div>

      { }
      <div className="flex-1 min-h-0 flex flex-col">
        {error && (
          <div className="m-4 p-3 rounded-lg border border-red-500/40 bg-red-500/10 text-[12.5px] text-red-300">
            {error}
            <div className="mt-2">
              <button
                onClick={start}
                className="h-8 px-3 rounded-md text-[12px] font-bold bg-red-500/20 text-red-200 border border-red-500/40 hover:bg-red-500/30 transition-colors"
              >
                Retry
              </button>
            </div>
          </div>
        )}
        {state === 'starting' && !error && (
          <div className="flex-1 flex items-center justify-center text-[12.5px] text-(--muted)">
            Starting the preview server…
          </div>
        )}
        {state === 'idle' && !error && (
          <div className="flex-1 flex items-center justify-center text-[12.5px] text-(--muted)">
            Preview is stopped.
          </div>
        )}
        {state === 'running' && iframeSrc && (
          <>
            {htmlFiles.length === 0 && (
              <div className="mx-4 mt-3 p-2.5 rounded-lg border border-amber-400/30 bg-amber-400/10 text-[12px] text-amber-300">
                No .html file found — create an <span className="font-mono">index.html</span> and the
                preview will appear here.
              </div>
            )}
            <iframe
              key={`${iframeKey}-${path}`}
              src={iframeSrc}
              title="Live preview"
              sandbox="allow-scripts allow-same-origin allow-modals"
              className="flex-1 w-full min-h-0 bg-white border-0"
            />
          </>
        )}
      </div>

      { }
      <div className="px-4 py-2 border-t border-(--line)">
        <p className="text-[11px] text-(--muted)">
          Served by the Synapse server from this project's workspace (localhost only).
        </p>
      </div>
    </div>
  );
}

export default PreviewPanel;

export function PreviewHost() {
  const [open, setOpen] = useState(false);
  const roomId = roomIdFromPath();

  useEffect(() => {
    const onOpen = () => setOpen(true);
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('synapse:open-preview', onOpen);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('synapse:open-preview', onOpen);
      window.removeEventListener('keydown', onKey);
    };
  }, []);

  if (!open) return null;

  
  
  return (
    <div className="fixed inset-y-0 right-0 w-[760px] max-w-[97vw] z-[70] bg-(--paper-2) border-l border-(--line) flex flex-col shadow-[0_0_48px_rgba(0,0,0,0.45)] animate-fade-in">
      <PreviewPanel roomId={roomId} onClose={() => setOpen(false)} />
    </div>
  );
}
