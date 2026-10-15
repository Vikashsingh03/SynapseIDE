import { useState, useEffect, useMemo, useCallback } from 'react';
import { API_BASE } from '../config/apiConfig';
import { getToken } from '../services/authService';
import {
  X,
  Database,
  Play,
  Braces,
  Table2,
  RefreshCw,
  PlugZap,
  Info,
  XCircle,
} from 'lucide-react';

 
 
 

function cellDisplay(v) {
  if (v === null || v === undefined) return '';
  if (Array.isArray(v)) return v.length ? '[…]' : '[]';
  if (typeof v === 'object') return '{…}';
  return String(v);
}

function DocTable({ documents }) {
  const columns = useMemo(() => {
    const keys = [];
    const seen = new Set();
    for (const doc of documents.slice(0, 10)) {
      for (const k of Object.keys(doc || {})) {
        if (!seen.has(k)) {
          seen.add(k);
          keys.push(k);
          if (keys.length >= 10) break;
        }
      }
      if (keys.length >= 10) break;
    }
    return keys;
  }, [documents]);

  if (!columns.length) return null;
  return (
    <div className="overflow-x-auto custom-scrollbar border border-(--line) rounded-xl">
      <table className="w-full text-[12px] border-collapse min-w-max">
        <thead>
          <tr className="bg-(--ink)/5">
            {columns.map((c) => (
              <th
                key={c}
                className="text-left font-semibold text-(--muted) px-3 py-2 border-b border-(--line) whitespace-nowrap sticky top-0"
              >
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {documents.map((doc, i) => (
            <tr
              key={i}
              className="border-b border-(--line)/50 last:border-0 hover:bg-(--ink)/[0.03]"
            >
              {columns.map((c) => (
                <td
                  key={c}
                  className="px-3 py-1.5 text-(--ink)/90 whitespace-nowrap max-w-[320px] overflow-hidden text-ellipsis font-mono"
                  title={cellDisplay(doc[c])}
                >
                  {cellDisplay(doc[c])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

 
 
 

export default function DbPanel({ onClose }) {
  const [uri, setUri] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [connected, setConnected] = useState(false);
  const [databases, setDatabases] = useState([]);
  const [db, setDb] = useState('');
  const [collections, setCollections] = useState([]);
  const [collection, setCollection] = useState('');
  const [filter, setFilter] = useState('{}');
  const [limit, setLimit] = useState(25);
  const [querying, setQuerying] = useState(false);
  const [documents, setDocuments] = useState(null);
  const [view, setView] = useState('json'); 
  const [error, setError] = useState('');

  const callApi = useCallback(async (path, body) => {
    const res = await fetch(`${API_BASE}/api/db${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${getToken()}`,
      },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data;
  }, []);

  const handleConnect = async () => {
    setError('');
    setConnecting(true);
    try {
      const data = await callApi('/connect', { uri });
      setDatabases(data.databases || []);
      const first = (data.databases || [])[0];
      setConnected(true);
      setDb(first ? first.name : '');
    } catch (e) {
      setError(e.message);
      setConnected(false);
    } finally {
      setConnecting(false);
    }
  };

  const loadCollections = useCallback(
    async (dbName) => {
      if (!dbName) {
        setCollections([]);
        setCollection('');
        return;
      }
      setError('');
      try {
        const data = await callApi('/collections', { uri, db: dbName });
        setCollections(data.collections || []);
        setCollection((data.collections || [])[0] || '');
      } catch (e) {
        setError(e.message);
        setCollections([]);
        setCollection('');
      }
    },
    [callApi, uri]
  );

  useEffect(() => {
    if (connected) loadCollections(db);
  }, [db, connected, loadCollections]);

  const handleRunQuery = async () => {
    setError('');
    setQuerying(true);
    try {
      const data = await callApi('/query', {
        uri,
        db,
        collection,
        filter,
        limit,
      });
      setDocuments(data.documents || []);
    } catch (e) {
      setError(e.message);
      setDocuments(null);
    } finally {
      setQuerying(false);
    }
  };

  const handleDisconnect = () => {
    setUri('');
    setConnected(false);
    setDatabases([]);
    setDb('');
    setCollections([]);
    setCollection('');
    setDocuments(null);
    setError('');
    setFilter('{}');
  };

  const dbSizes = useMemo(() => {
    const m = {};
    for (const d of databases) m[d.name] = d.sizeOnDisk;
    return m;
  }, [databases]);

  const fmtBytes = (b) => {
    if (!b) return '0 B';
    if (b < 1024) return `${b} B`;
    if (b < 1048576) return `${(b / 1024).toFixed(1)} KB`;
    return `${(b / 1048576).toFixed(1)} MB`;
  };

  return (
    <div className="flex flex-col h-full">
      { }
      <div className="flex items-center gap-2.5 px-5 py-4 border-b border-(--line) shrink-0">
        <span className="p-1.5 rounded-lg bg-(--blue)/10 border border-(--blue)/25 text-(--blue)">
          <Database size={16} />
        </span>
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-bold text-(--ink)">Database</h2>
          <p className="text-[11px] text-(--muted)">Read-only MongoDB explorer</p>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-md text-(--muted) hover:text-(--ink) hover:bg-(--ink)/5 transition-colors cursor-pointer"
          aria-label="Close database panel"
        >
          <X size={16} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-5 custom-scrollbar flex flex-col gap-4">
        {!connected ? (
          <>
            { }
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-(--muted) mb-2">
                Connection string
              </label>
              <input
                type="password"
                value={uri}
                onChange={(e) => setUri(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleConnect()}
                placeholder="mongodb://localhost:27017/mydb"
                autoComplete="off"
                spellCheck={false}
                className="w-full px-3 py-2.5 rounded-xl bg-black/30 border border-(--line) text-[13px] font-mono text-(--ink) placeholder:text-(--muted)/50 focus:outline-none focus:border-(--blue)/60"
              />
            </div>
            <button
              onClick={handleConnect}
              disabled={connecting || !uri.trim()}
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-(--blue) text-white text-[13px] font-semibold hover:brightness-110 disabled:opacity-40 transition-all cursor-pointer"
            >
              {connecting ? (
                <RefreshCw size={14} className="animate-spin" />
              ) : (
                <PlugZap size={14} />
              )}
              {connecting ? 'Connecting…' : 'Connect'}
            </button>
          </>
        ) : (
          <>
            { }
            <div className="flex flex-col gap-3">
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-(--muted) mb-2">
                  Database
                </label>
                <select
                  value={db}
                  onChange={(e) => setDb(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-black/30 border border-(--line) text-[13px] text-(--ink) focus:outline-none focus:border-(--blue)/60 cursor-pointer"
                >
                  {databases.map((d) => (
                    <option key={d.name} value={d.name} className="bg-[#14181f]">
                      {d.name}
                      {dbSizes[d.name] ? ` (${fmtBytes(dbSizes[d.name])})` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-(--muted) mb-2">
                  Collection
                </label>
                <select
                  value={collection}
                  onChange={(e) => setCollection(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-black/30 border border-(--line) text-[13px] text-(--ink) focus:outline-none focus:border-(--blue)/60 cursor-pointer"
                >
                  {collections.map((c) => (
                    <option key={c} value={c} className="bg-[#14181f]">
                      {c}
                    </option>
                  ))}
                  {!collections.length && (
                    <option value="" className="bg-[#14181f]">
                      — no collections —
                    </option>
                  )}
                </select>
              </div>
            </div>

            { }
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-(--muted) mb-2">
                Filter (JSON)
              </label>
              <textarea
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                rows={3}
                spellCheck={false}
                className="w-full px-3 py-2 rounded-xl bg-black/30 border border-(--line) text-[12.5px] font-mono text-(--ink) focus:outline-none focus:border-(--blue)/60 resize-y"
              />
            </div>
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-(--muted) mb-2">
                  Limit (max 100)
                </label>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={limit}
                  onChange={(e) => setLimit(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl bg-black/30 border border-(--line) text-[13px] font-mono text-(--ink) focus:outline-none focus:border-(--blue)/60"
                />
              </div>
              <button
                onClick={handleRunQuery}
                disabled={querying || !collection}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-(--blue) text-white text-[13px] font-semibold hover:brightness-110 disabled:opacity-40 transition-all cursor-pointer self-end"
              >
                {querying ? (
                  <RefreshCw size={14} className="animate-spin" />
                ) : (
                  <Play size={14} />
                )}
                Run Query
              </button>
            </div>

            <button
              onClick={handleDisconnect}
              className="self-start text-[12px] text-(--muted) hover:text-(--ink) underline underline-offset-4 transition-colors cursor-pointer"
            >
              Disconnect
            </button>

            { }
            {documents !== null && (
              <div className="flex flex-col gap-2 min-h-0">
                <div className="flex items-center justify-between">
                  <span className="text-[12px] text-(--muted)">
                    {documents.length} document{documents.length === 1 ? '' : 's'}
                  </span>
                  <div className="flex rounded-lg border border-(--line) overflow-hidden">
                    <button
                      onClick={() => setView('json')}
                      className={`flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold transition-colors cursor-pointer ${
                        view === 'json'
                          ? 'bg-(--blue)/20 text-(--blue)'
                          : 'text-(--muted) hover:text-(--ink)'
                      }`}
                    >
                      <Braces size={12} /> JSON
                    </button>
                    <button
                      onClick={() => setView('table')}
                      className={`flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold transition-colors cursor-pointer ${
                        view === 'table'
                          ? 'bg-(--blue)/20 text-(--blue)'
                          : 'text-(--muted) hover:text-(--ink)'
                      }`}
                    >
                      <Table2 size={12} /> Table
                    </button>
                  </div>
                </div>
                {documents.length === 0 ? (
                  <div className="rounded-xl border border-(--line) bg-black/20 px-4 py-8 text-center text-[13px] text-(--muted)">
                    No documents match.
                  </div>
                ) : view === 'json' ? (
                  <pre className="rounded-xl border border-(--line) bg-black/30 p-4 text-[12px] font-mono text-(--ink)/90 overflow-auto custom-scrollbar max-h-[420px]">
                    {JSON.stringify(documents, null, 2)}
                  </pre>
                ) : (
                  <DocTable documents={documents} />
                )}
              </div>
            )}
          </>
        )}

        { }
        {error && (
          <div className="flex items-start gap-2 rounded-xl border border-red-500/50 bg-red-500/10 px-3.5 py-3 text-[12.5px] text-red-300 break-words">
            <XCircle size={15} className="shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        { }
        <div className="flex items-start gap-2 mt-auto pt-2 text-[11.5px] text-(--muted)">
          <Info size={13} className="shrink-0 mt-0.5" />
          <span>
            Read-only. Your connection string stays in this panel — it is never
            saved.
          </span>
        </div>
      </div>
    </div>
  );
}

 
 
 

export function DbHost() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onOpen = () => setOpen(true);
    const onClose = () => setOpen(false);
    window.addEventListener('synapse:open-db', onOpen);
    window.addEventListener('synapse:close-db', onClose);
    return () => {
      window.removeEventListener('synapse:open-db', onOpen);
      window.removeEventListener('synapse:close-db', onClose);
    };
  }, []);

  if (!open) return null;
  return (
    <div className="fixed inset-y-0 right-0 w-[600px] max-w-[97vw] z-[70] bg-(--paper-2) border-l border-(--line) flex flex-col shadow-[0_0_48px_rgba(0,0,0,0.45)] animate-fade-in">
      <DbPanel onClose={() => setOpen(false)} />
    </div>
  );
}
