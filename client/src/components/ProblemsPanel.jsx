import { useEffect, useMemo, useState } from 'react';
import { XCircle, AlertTriangle, Info, CheckCircle2, RefreshCw, Loader2, Wand2 } from 'lucide-react';
import { useFiles } from '../contexts/FileContext';
import FileIcon from './FileIcon';
import { API_BASE } from '../config/apiConfig';
import { getToken } from '../services/authService';
import {
  getProblems,
  getCounts,
  setTypecheckProblems,
  subscribe,
} from '../diagnostics/problemsStore';

const TYPECHECK_EXTENSIONS = new Set(['ts', 'tsx', 'js', 'jsx', 'mts', 'cts']);

function extensionOf(name) {
  const base = (name || '').split('/').pop();
  const dot = base.lastIndexOf('.');
  return dot > 0 ? base.slice(dot + 1).toLowerCase() : '';
}

 
function filePathFor(file, byId) {
  const parts = [file.name];
  const seen = new Set([file.id]);
  let parentId = file.parentId;
  while (parentId) {
    const parent = byId.get(parentId);
    if (!parent || seen.has(parent.id)) break;
    seen.add(parent.id);
    if (parent.type === 'folder') parts.unshift(parent.name);
    parentId = parent.parentId;
  }
  return parts.join('/');
}

function SeverityIcon({ severity }) {
  if (severity === 'error') return <XCircle size={13} className="text-[#F87171] shrink-0" />;
  if (severity === 'warning') return <AlertTriangle size={13} className="text-[#FBBF24] shrink-0" />;
  return <Info size={13} className="text-[#58A6FF] shrink-0" />;
}

export default function ProblemsPanel() {
  const { files, openTab } = useFiles();
  const [problems, setProblems] = useState(() => getProblems());
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const refresh = () => setProblems(getProblems());
    const unsubscribe = subscribe(refresh);
    return unsubscribe;
  }, []);

  const counts = useMemo(() => getCounts(), [problems]);

  const grouped = useMemo(() => {
    const groups = new Map();
    for (const p of problems) {
      const key = p.fileName || 'unknown';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(p);
    }
    
    const rank = { error: 0, warning: 1, info: 2 };
    for (const list of groups.values()) {
      list.sort((a, b) => (rank[a.severity] ?? 3) - (rank[b.severity] ?? 3) || a.line - b.line);
    }
    return [...groups.entries()];
  }, [problems]);

  const runTypeCheck = async () => {
    setError('');
    setRunning(true);
    try {
      const byId = new Map(files.map((f) => [f.id, f]));
      const payload = files
        .filter(
          (f) =>
            f.type === 'file' &&
            f.content &&
            TYPECHECK_EXTENSIONS.has(extensionOf(f.name))
        )
        .map((f) => ({ id: f.id, name: f.name, path: filePathFor(f, byId), content: f.content }));

      if (!payload.length) {
        setError('No TypeScript/JavaScript files to check in this project.');
        setRunning(false);
        return;
      }

      const pathToFile = new Map(payload.map((f) => [f.path, f]));
      const baseToFile = new Map(payload.map((f) => [f.name.toLowerCase(), f]));

      const token = getToken();
      const res = await fetch(`${API_BASE}/typecheck`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          files: payload.map(({ path, content }) => ({ path, content })),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || `Type check failed (${res.status}).`);
      }

      const diagnostics = Array.isArray(data.diagnostics) ? data.diagnostics : [];
      const mapped = diagnostics.map((d) => {
        const diagPath = d.path || '';
        const byPath = pathToFile.get(diagPath);
        const base = diagPath.split('/').pop().toLowerCase();
        const file = byPath || baseToFile.get(base) || null;
        const fileName = file ? file.name : base || diagPath || 'unknown';
        return {
          fileId: file ? file.id : null,
          fileName,
          path: diagPath || null,
          line: d.line,
          column: d.column,
          severity: d.severity,
          code: d.code,
          message: d.code ? `${d.code}: ${d.message || ''}` : d.message,
          source: 'typecheck',
        };
      });
      setTypecheckProblems(mapped);
    } catch (err) {
      setError(err?.message || 'Type check failed — is the server running?');
    } finally {
      setRunning(false);
    }
  };

  const jumpToProblem = (p) => {
    if (!p.fileId) return;
    openTab(p.fileId);
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('synapse:goto-line', { detail: { line: p.line } }));
    }, 160);
  };

  const fixWithNeura = (p) => {
    window.dispatchEvent(
      new CustomEvent('synapse:neura-fix', {
        detail: {
          fileId: p.fileId || null,
          relPath: p.path || null,
          fileName: p.fileName || 'unknown',
          line: p.line,
          column: p.column,
          message: p.message,
        },
      })
    );
  };

  return (
    <div className="h-full flex flex-col min-h-0 bg-[#0B0F16] text-[#C7D3E8]">
      { }
      <div className="h-[34px] flex items-center justify-between px-3.5 border-b border-white/[0.06] shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#EAF1FB]">
            Problems
          </span>
          {counts.errors > 0 && (
            <span className="flex items-center gap-1 text-[10.5px] font-semibold text-[#F87171] bg-[#F87171]/10 rounded-full px-1.5 py-0.5 tabular-nums">
              <XCircle size={11} /> {counts.errors}
            </span>
          )}
          {counts.warnings > 0 && (
            <span className="flex items-center gap-1 text-[10.5px] font-semibold text-[#FBBF24] bg-[#FBBF24]/10 rounded-full px-1.5 py-0.5 tabular-nums">
              <AlertTriangle size={11} /> {counts.warnings}
            </span>
          )}
        </div>
        <button
          onClick={runTypeCheck}
          disabled={running}
          title="Run project-wide TypeScript check"
          className="flex items-center gap-1.5 text-[11px] font-medium text-[#A9B7CC] hover:text-[#EAF1FB] hover:bg-white/5 rounded-md px-2 py-1 transition-colors disabled:opacity-50 disabled:cursor-wait cursor-pointer"
        >
          {running ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
          {running ? 'Checking…' : 'Type Check'}
        </button>
      </div>
      <div className="px-3.5 py-1.5 text-[10.5px] text-[#5C6B82] border-b border-white/[0.04] shrink-0">
        Live problems from the editor + project-wide TypeScript check.
      </div>

      {error && (
        <div className="px-3.5 py-2 text-[11.5px] text-[#F87171] bg-[#F87171]/8 border-b border-white/[0.05] shrink-0">
          {error}
        </div>
      )}

      { }
      <div className="flex-1 overflow-y-auto min-h-0">
        {problems.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center gap-2 text-center px-6">
            <CheckCircle2 size={26} className="text-[#3F5A43]" />
            <p className="text-[12.5px] font-semibold text-[#9AA9C2]">No problems detected</p>
            <p className="text-[11px] text-[#5C6B82]">
              Run Type Check to scan every TypeScript and JavaScript file.
            </p>
          </div>
        ) : (
          grouped.map(([fileName, list]) => (
            <div key={fileName} className="border-b border-white/[0.05]">
              <div className="flex items-center gap-1.5 px-3.5 py-1.5 bg-white/[0.02]">
                <FileIcon name={fileName} size={12} />
                <span className="text-[11px] font-semibold text-[#9AA9C2] truncate">{fileName}</span>
                <span className="ml-auto text-[10px] font-semibold text-[#5C6B82] tabular-nums shrink-0">
                  {list.length}
                </span>
              </div>
              {list.map((p, i) => (
                <div key={`${p.fileId || p.path || ''}-${p.line}-${p.column}-${i}`} className="relative group/row">
                  <button
                    onClick={() => jumpToProblem(p)}
                    className={`w-full text-left flex items-start gap-2 px-3.5 py-[7px] ${
                      p.fileId || p.path ? 'pr-[88px]' : ''
                    } hover:bg-white/[0.04] transition-colors ${
                      p.fileId ? 'cursor-pointer' : 'cursor-default'
                    }`}
                  >
                    <span className="mt-[1px]">
                      <SeverityIcon severity={p.severity} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[12px] leading-snug text-[#C7D3E8] break-words">
                        {p.message}
                      </span>
                    </span>
                    <span className="flex items-center gap-2 shrink-0">
                      <span className="text-[9.5px] font-semibold uppercase tracking-wide text-[#5C6B82] border border-white/[0.08] rounded px-1 py-px">
                        {p.source === 'typecheck' ? 'tsc' : 'editor'}
                      </span>
                      <span className="text-[10.5px] text-[#5C6B82] font-mono tabular-nums whitespace-nowrap">
                        Ln {p.line}, Col {p.column}
                      </span>
                    </span>
                  </button>
                  {(p.fileId || p.path) && (
                    <button
                      type="button"
                      title="Fix with Neura"
                      onClick={(e) => {
                        e.stopPropagation();
                        fixWithNeura(p);
                      }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 hidden group-hover/row:flex items-center gap-1.5 rounded-md border border-[#D9FF3F]/30 bg-[#D9FF3F]/10 px-2 py-1 font-mono text-[10px] font-bold text-[#D9FF3F] hover:bg-[#D9FF3F]/20 transition-colors cursor-pointer"
                    >
                      <Wand2 size={12} />
                      Fix
                    </button>
                  )}
                </div>
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
