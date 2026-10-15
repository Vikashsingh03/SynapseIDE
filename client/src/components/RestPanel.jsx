import { useState, useEffect, useMemo } from 'react';
import { useFiles } from '../contexts/FileContext';
import { API_BASE } from '../config/apiConfig';
import { getToken } from '../services/authService';
import { parseHttpFile } from '../utils/httpFile';
import { Globe, Send, Plus, Trash2, X, Clock, FileText } from 'lucide-react';

const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];

const METHOD_COLORS = {
  GET: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/30',
  POST: 'text-sky-400 bg-sky-400/10 border-sky-400/30',
  PUT: 'text-amber-400 bg-amber-400/10 border-amber-400/30',
  PATCH: 'text-violet-400 bg-violet-400/10 border-violet-400/30',
  DELETE: 'text-red-400 bg-red-400/10 border-red-400/30',
};

const HISTORY_KEY = 'synapse-rest-history';

function readHistory() {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    const arr = JSON.parse(raw || '[]');
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function prettyBody(body, isJson) {
  if (isJson && body) {
    try {
      return JSON.stringify(JSON.parse(body), null, 2);
    } catch {
      return body;
    }
  }
  return body;
}

function statusClass(status) {
  if (status >= 200 && status < 300) return 'text-emerald-400 bg-emerald-400/10 border-emerald-400/30';
  if (status >= 400 && status < 500) return 'text-amber-400 bg-amber-400/10 border-amber-400/30';
  if (status >= 500) return 'text-red-400 bg-red-400/10 border-red-400/30';
  return 'text-slate-300 bg-white/5 border-white/10';
}

 
 
 

export default function RestPanel({ onClose }) {
  const { files } = useFiles();

  const [method, setMethod] = useState('GET');
  const [url, setUrl] = useState('https://jsonplaceholder.typicode.com/posts/1');
  const [headerRows, setHeaderRows] = useState([{ key: '', value: '' }]);
  const [body, setBody] = useState('');
  const [loading, setLoading] = useState(false);
  const [resp, setResp] = useState(null); 
  const [view, setView] = useState('body'); 
  const [history, setHistory] = useState(readHistory);
  const [httpFileId, setHttpFileId] = useState('');
  const [fileRequests, setFileRequests] = useState(null); 

  const httpFiles = useMemo(
    () =>
      (files || []).filter(
        (f) => f.type !== 'folder' && /\.(http|rest)$/i.test(f.name || '')
      ),
    [files]
  );

  const selectedFile = useMemo(
    () => httpFiles.find((f) => f.id === httpFileId) || null,
    [httpFiles, httpFileId]
  );

  const fileHasVars = useMemo(
    () => !!selectedFile && /\{\{[^}]+\}\}/.test(selectedFile.content || ''),
    [selectedFile]
  );

  
  useEffect(() => {
    if (!selectedFile) {
      setFileRequests(null);
      return;
    }
    try {
      setFileRequests(parseHttpFile(selectedFile.content || ''));
    } catch {
      setFileRequests([]);
    }
  }, [selectedFile]);

  const loadRequest = (r) => {
    setMethod(r.method);
    setUrl(r.url);
    const rows = Object.entries(r.headers || {}).map(([key, value]) => ({
      key,
      value,
    }));
    rows.push({ key: '', value: '' });
    setHeaderRows(rows);
    setBody(r.body || '');
    setView('body');
    setResp(null);
  };

  const updateRow = (i, field, value) => {
    setHeaderRows((prev) =>
      prev.map((row, idx) => (idx === i ? { ...row, [field]: value } : row))
    );
  };

  const send = async () => {
    const trimmedUrl = (url || '').trim();
    if (!trimmedUrl || loading) return;
    const headersObj = {};
    for (const { key, value } of headerRows) {
      if (key && key.trim()) headersObj[key.trim()] = value || '';
    }
    const payload = {
      method,
      url: trimmedUrl,
      headers: headersObj,
      body: method === 'GET' ? undefined : body,
    };
    setLoading(true);
    setResp(null);
    try {
      const token = getToken();
      const res = await fetch(`${API_BASE}/proxy`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok && data && data.error) {
        setResp({ error: data.error });
      } else {
        setResp(data);
        
        const entry = {
          method,
          url: trimmedUrl,
          headers: headersObj,
          body: method === 'GET' ? '' : body,
          at: Date.now(),
        };
        setHistory((prev) => {
          const next = [entry, ...prev].slice(0, 20);
          try {
            localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
          } catch {}
          return next;
        });
      }
    } catch (err) {
      setResp({ error: err?.message || 'Request failed' });
    } finally {
      setLoading(false);
    }
  };

  const clearHistory = () => {
    setHistory([]);
    try {
      localStorage.removeItem(HISTORY_KEY);
    } catch {}
  };

  const loadHistory = (h) => {
    setMethod(h.method || 'GET');
    setUrl(h.url || '');
    const rows = Object.entries(h.headers || {}).map(([key, value]) => ({
      key,
      value,
    }));
    rows.push({ key: '', value: '' });
    setHeaderRows(rows);
    setBody(h.body || '');
    setView('body');
    setResp(null);
  };

  return (
    <div className="flex flex-col h-full">
      { }
      <div className="flex items-center gap-2.5 px-5 py-4 border-b border-(--line) shrink-0">
        <span className="p-1.5 rounded-lg bg-(--blue)/10 border border-(--blue)/25 text-(--blue)">
          <Globe size={16} />
        </span>
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-bold text-(--ink)">REST Client</h2>
          <p className="text-[11px] text-(--muted)">Test APIs through the Synapse proxy</p>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-md text-(--muted) hover:text-(--ink) hover:bg-(--ink)/5 transition-colors cursor-pointer"
          aria-label="Close REST client"
        >
          <X size={16} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        { }
        <div className="p-4 space-y-3 border-b border-(--line)">
          <div className="flex gap-2">
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value)}
              className={`text-xs font-bold px-2 py-2 rounded-lg border bg-black/30 outline-none cursor-pointer shrink-0 ${METHOD_COLORS[method]}`}
              aria-label="HTTP method"
            >
              {METHODS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') send();
              }}
              placeholder="https://api.example.com/users"
              spellCheck={false}
              className="flex-1 min-w-0 text-[13px] font-mono px-3 py-2 rounded-lg bg-black/30 border border-(--line) text-(--ink) placeholder:text-(--muted)/50 outline-none focus:border-(--blue)/60"
            />
            <button
              onClick={send}
              disabled={loading}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold bg-(--acid)/15 border border-(--acid)/35 text-(--acid) hover:bg-(--acid)/25 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-wait shrink-0"
            >
              <Send size={13} />
              {loading ? 'Sending…' : 'Send'}
            </button>
          </div>

          { }
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-(--muted) mb-1.5">
              Headers
            </div>
            <div className="space-y-1.5">
              {headerRows.map((row, i) => (
                <div key={i} className="flex gap-1.5">
                  <input
                    value={row.key}
                    onChange={(e) => updateRow(i, 'key', e.target.value)}
                    placeholder="Header"
                    spellCheck={false}
                    className="flex-1 min-w-0 text-xs font-mono px-2.5 py-1.5 rounded-md bg-black/30 border border-(--line) text-(--ink) placeholder:text-(--muted)/50 outline-none focus:border-(--blue)/60"
                  />
                  <input
                    value={row.value}
                    onChange={(e) => updateRow(i, 'value', e.target.value)}
                    placeholder="Value"
                    spellCheck={false}
                    className="flex-[1.4] min-w-0 text-xs font-mono px-2.5 py-1.5 rounded-md bg-black/30 border border-(--line) text-(--ink) placeholder:text-(--muted)/50 outline-none focus:border-(--blue)/60"
                  />
                  <button
                    onClick={() =>
                      setHeaderRows((prev) => prev.filter((_, idx) => idx !== i))
                    }
                    className="p-1.5 rounded-md text-(--muted) hover:text-red-400 hover:bg-red-400/10 transition-colors cursor-pointer shrink-0"
                    aria-label="Remove header"
                  >
                    <X size={13} />
                  </button>
                </div>
              ))}
              <button
                onClick={() =>
                  setHeaderRows((prev) => [...prev, { key: '', value: '' }])
                }
                className="flex items-center gap-1 text-[11px] font-bold text-(--muted) hover:text-(--ink) transition-colors cursor-pointer"
              >
                <Plus size={12} /> Add header
              </button>
            </div>
          </div>

          { }
          {method !== 'GET' && (
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-(--muted) mb-1.5">
                Body
              </div>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={6}
                spellCheck={false}
                placeholder={'{\n  "key": "value"\n}'}
                className="w-full text-xs font-mono px-3 py-2.5 rounded-lg bg-black/30 border border-(--line) text-(--ink) placeholder:text-(--muted)/40 outline-none focus:border-(--blue)/60 resize-y custom-scrollbar"
              />
            </div>
          )}
        </div>

        { }
        {resp && (
          <div className="p-4 border-b border-(--line)">
            {resp.error ? (
              <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-3.5">
                <div className="text-[10px] font-bold uppercase tracking-wider text-red-400 mb-1">
                  Request failed
                </div>
                <p className="text-[13px] text-red-200 leading-relaxed break-words">
                  {resp.error}
                </p>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2 flex-wrap mb-2.5">
                  <span
                    className={`text-xs font-bold font-mono px-2 py-1 rounded-md border ${statusClass(resp.status)}`}
                  >
                    {resp.status} {resp.statusText}
                  </span>
                  <span className="flex items-center gap-1 text-[11px] text-(--muted)">
                    <Clock size={11} /> {resp.timeMs}ms
                  </span>
                  <span className="text-[11px] text-(--muted) font-mono">
                    {resp.sizeBytes >= 1024
                      ? `${(resp.sizeBytes / 1024).toFixed(1)} KB`
                      : `${resp.sizeBytes} B`}
                  </span>
                  <div className="ml-auto flex gap-1 p-0.5 rounded-lg bg-black/30 border border-(--line)">
                    {['body', 'headers'].map((v) => (
                      <button
                        key={v}
                        onClick={() => setView(v)}
                        className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-colors cursor-pointer ${
                          view === v
                            ? 'bg-(--ink)/10 text-(--ink)'
                            : 'text-(--muted) hover:text-(--ink)'
                        }`}
                      >
                        {v === 'body' ? 'Body' : 'Headers'}
                      </button>
                    ))}
                  </div>
                </div>
                {view === 'body' ? (
                  <pre className="text-[12px] font-mono leading-relaxed p-3.5 rounded-xl bg-black/40 border border-(--line) text-(--ink) overflow-auto max-h-[320px] custom-scrollbar whitespace-pre-wrap break-words">
                    {prettyBody(resp.body, resp.isJson) || '(empty body)'}
                  </pre>
                ) : (
                  <div className="rounded-xl bg-black/40 border border-(--line) overflow-hidden">
                    {Object.entries(resp.headers || {}).map(([k, v]) => (
                      <div
                        key={k}
                        className="flex gap-3 px-3.5 py-1.5 border-b border-(--line)/50 last:border-0 text-[12px] font-mono"
                      >
                        <span className="text-(--blue) shrink-0 break-all">{k}</span>
                        <span className="text-(--ink)/80 break-all">{String(v)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        { }
        {httpFiles.length > 0 && (
          <div className="p-4 border-b border-(--line)">
            <div className="flex items-center gap-2 mb-2">
              <FileText size={13} className="text-(--muted)" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-(--muted)">
                From .http file
              </span>
            </div>
            <select
              value={httpFileId}
              onChange={(e) => setHttpFileId(e.target.value)}
              className="w-full text-xs px-2.5 py-2 rounded-lg bg-black/30 border border-(--line) text-(--ink) outline-none cursor-pointer mb-2"
            >
              <option value="">Choose a .http file…</option>
              {httpFiles.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
            {fileHasVars && (
              <p className="text-[11px] text-amber-400/90 mb-2">
                This file uses {'{{variables}}'} — they are used as-is.
              </p>
            )}
            {fileRequests && fileRequests.length > 0 && (
              <div className="space-y-1.5">
                {fileRequests.map((r, i) => (
                  <button
                    key={i}
                    onClick={() => loadRequest(r)}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg bg-black/20 border border-(--line) hover:border-(--blue)/50 transition-colors cursor-pointer text-left"
                  >
                    <span
                      className={`text-[10px] font-bold font-mono px-1.5 py-0.5 rounded border shrink-0 ${METHOD_COLORS[r.method]}`}
                    >
                      {r.method}
                    </span>
                    <span className="text-[12px] font-mono text-(--ink)/85 truncate flex-1">
                      {r.name || r.url}
                    </span>
                  </button>
                ))}
              </div>
            )}
            {fileRequests && fileRequests.length === 0 && (
              <p className="text-[11px] text-(--muted)">
                No requests found in this file.
              </p>
            )}
          </div>
        )}

        { }
        <div className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <Clock size={13} className="text-(--muted)" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-(--muted)">
              History
            </span>
            {history.length > 0 && (
              <button
                onClick={clearHistory}
                className="ml-auto flex items-center gap-1 text-[11px] text-(--muted) hover:text-red-400 transition-colors cursor-pointer"
              >
                <Trash2 size={12} /> Clear
              </button>
            )}
          </div>
          {history.length === 0 ? (
            <p className="text-[11px] text-(--muted)">
              Sent requests will appear here.
            </p>
          ) : (
            <div className="space-y-1.5">
              {history.map((h, i) => (
                <button
                  key={`${h.at}-${i}`}
                  onClick={() => loadHistory(h)}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg bg-black/20 border border-(--line) hover:border-(--blue)/50 transition-colors cursor-pointer text-left"
                >
                  <span
                    className={`text-[10px] font-bold font-mono px-1.5 py-0.5 rounded border shrink-0 ${METHOD_COLORS[h.method]}`}
                  >
                    {h.method}
                  </span>
                  <span className="text-[12px] font-mono text-(--ink)/85 truncate flex-1">
                    {h.url}
                  </span>
                  <span className="text-[10px] text-(--muted) shrink-0">
                    {new Date(h.at).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

 
 
 

export function RestHost() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener('synapse:open-rest', onOpen);
    return () => window.removeEventListener('synapse:open-rest', onOpen);
  }, []);

  if (!open) return null;
  return (
    <div className="fixed inset-y-0 right-0 w-[560px] max-w-[96vw] z-[70] bg-(--paper-2) border-l border-(--line) flex flex-col shadow-[0_0_48px_rgba(0,0,0,0.45)] animate-fade-in">
      <RestPanel onClose={() => setOpen(false)} />
    </div>
  );
}
