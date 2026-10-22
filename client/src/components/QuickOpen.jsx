import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Search, CornerDownLeft } from 'lucide-react';
import { useFiles } from '../contexts/FileContext';
import { relPathOf } from '../debug/breakpointsStore';
import { fuzzyMatch, compareScored } from '../utils/fuzzyMatch';
import FileIcon from './FileIcon';

const RECENT_KEY = 'synapse-quickopen-recent';
const KEYBINDINGS_KEY = 'synapse-keybindings';
const MAX_RESULTS = 12;
const MAX_RECENT = 8;

function readRecent() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(RECENT_KEY) || '[]');
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

function pushRecent(id) {
  try {
    const next = [id, ...readRecent().filter((x) => x !== id)].slice(0, MAX_RECENT);
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
  }
}

function quickOpenChordIsDefault() {
  try {
    const raw = window.localStorage.getItem(KEYBINDINGS_KEY);
    if (!raw) return true;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return true;
    const override = parsed.quickOpen;
    if (!override) return true;
    const chord = typeof override === 'string' ? override : override.chord;
    if (!chord) return true;
    return String(chord).trim().toLowerCase() === 'ctrl+p';
  } catch {
    return true;
  }
}

function Highlighted({ text, indices, dim }) {
  if (!indices || !indices.length) return <>{text}</>;
  const set = new Set(indices);
  const parts = [];
  let buf = '';
  let hl = false;
  const flush = () => {
    if (buf) {
      parts.push({ t: buf, hl });
      buf = '';
    }
  };
  for (let i = 0; i < text.length; i++) {
    const is = set.has(i);
    if (is !== hl) {
      flush();
      hl = is;
    }
    buf += text[i];
  }
  flush();
  return (
    <>
      {parts.map((p, i) =>
        p.hl ? (
          <span key={i} className={dim ? 'text-(--blue) font-bold' : 'text-(--blue) font-extrabold'}>
            {p.t}
          </span>
        ) : (
          <span key={i}>{p.t}</span>
        )
      )}
    </>
  );
}

export function QuickOpenHost() {
  const { files, activeFile, openTab } = useFiles();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(0);
  const [recentIds, setRecentIds] = useState(() => readRecent());
  const inputRef = useRef(null);
  const listRef = useRef(null);

  const fileList = useMemo(
    () => (files || []).filter((f) => f.type !== 'folder'),
    [files]
  );
  const pathOf = useCallback((f) => relPathOf(f, files) || f.name, [files]);

  useEffect(() => {
    if (activeFile && activeFile.type !== 'folder') {
      pushRecent(activeFile.id);
      setRecentIds(readRecent());
    }
  }, [activeFile?.id]);

  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener('synapse:quick-open', onOpen);
    return () => window.removeEventListener('synapse:quick-open', onOpen);
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && (e.key === 'p' || e.key === 'P')) {
        if (!quickOpenChordIsDefault()) return;
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (open) {
      setQuery('');
      setSelected(0);
      const id = setTimeout(() => inputRef.current?.focus(), 30);
      return () => clearTimeout(id);
    }
  }, [open ]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open ]);

  const results = useMemo(() => {
    const q = query.trim();
    if (!q) {
      const byId = new Map(fileList.map((f) => [f.id, f]));
      const out = [];
      for (const id of recentIds) {
        const f = byId.get(id);
        if (f) {
          out.push({ file: f, path: pathOf(f), recent: true, nameMatch: null, pathMatch: null });
          byId.delete(id);
        }
      }
      const rest = [...byId.values()].sort((a, b) => pathOf(a).localeCompare(pathOf(b)));
      for (const f of rest) {
        out.push({ file: f, path: pathOf(f), recent: false, nameMatch: null, pathMatch: null });
      }
      return out.slice(0, MAX_RESULTS);
    }
    const scored = [];
    for (const f of fileList) {
      const path = pathOf(f);
      const nameMatch = fuzzyMatch(q, f.name);
      const pathMatch = fuzzyMatch(q, path);
      const nameScore = nameMatch ? nameMatch.score : null;
      const pathScore = pathMatch ? Math.round(pathMatch.score * 0.85) : null;
      const best = Math.max(nameScore ?? -Infinity, pathScore ?? -Infinity);
      if (best === -Infinity) continue;
      scored.push({ file: f, path, score: best, text: path, nameMatch, pathMatch, recent: false });
    }
    scored.sort((a, b) => compareScored(a, b) || a.path.localeCompare(b.path));
    return scored.slice(0, MAX_RESULTS);
  }, [query, fileList, recentIds, pathOf]);

  useEffect(() => {
    setSelected(0);
  }, [query]);

  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-idx="${selected}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [selected]);

  const openFile = (entry) => {
    if (!entry) return;
    pushRecent(entry.file.id);
    setRecentIds(readRecent());
    openTab(entry.file.id);
    setOpen(false);
  };

  const onInputKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelected((s) => (results.length ? (s + 1) % results.length : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelected((s) => (results.length ? (s - 1 + results.length) % results.length : 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      openFile(results[selected]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  if (!open) return null;

  const hasRecent = results.some((r) => r.recent);

  return (
    <div
      className="fixed inset-0 z-100 flex justify-center px-4 pt-[16vh] bg-black/60 animate-fade-in"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-full max-w-xl h-fit rounded-xl border border-(--line) overflow-hidden shadow-[0_30px_90px_rgba(20,21,20,0.25)] animate-spring-in bg-(--paper-2)"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-5 py-4 border-b border-(--line)">
          <Search size={17} className="text-(--muted) shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onInputKeyDown}
            placeholder="Search files by name or path…"
            className="flex-1 bg-transparent outline-none text-sm text-(--ink) placeholder:text-(--muted)"
          />
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-(--line) text-(--muted)">esc</span>
        </div>

        <div ref={listRef} className="max-h-[46vh] overflow-y-auto p-2 custom-scrollbar">
          {results.length === 0 && (
            <p className="text-center text-sm text-(--muted) py-8">
              {query.trim() ? `No files match "${query.trim()}"` : 'No files in this project yet'}
            </p>
          )}
          {results.map((entry, i) => {
            const isSel = i === selected;
            const showRecentHead = !query.trim() && entry.recent && i === 0;
            const showFilesHead =
              !query.trim() && !entry.recent && hasRecent && (i === 0 || results[i - 1].recent);
            return (
              <div key={entry.file.id}>
                {showRecentHead && (
                  <p className="px-3 pt-2.5 pb-1 text-[10px] font-bold uppercase tracking-[0.14em] text-(--muted)">
                    Recent
                  </p>
                )}
                {showFilesHead && (
                  <p className="px-3 pt-2.5 pb-1 text-[10px] font-bold uppercase tracking-[0.14em] text-(--muted)">
                    Files
                  </p>
                )}
                <button
                  data-idx={i}
                  onClick={() => openFile(entry)}
                  onMouseEnter={() => setSelected(i)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-left text-sm cursor-pointer transition-colors duration-150 ${
                    isSel ? 'bg-(--blue)/8 text-(--ink)' : 'text-(--muted)'
                  }`}
                >
                  <span
                    className={`p-1.5 rounded-md shrink-0 border ${
                      isSel
                        ? 'bg-(--blue)/10 border-(--blue)/30 text-(--blue)'
                        : 'bg-(--ink)/3 border-(--line) text-(--muted)'
                    }`}
                  >
                    <FileIcon name={entry.file.name} size={14} />
                  </span>
                  <span className="flex-1 min-w-0 flex items-baseline gap-2">
                    <span className="truncate font-bold shrink-0 max-w-[55%]">
                      <Highlighted text={entry.file.name} indices={entry.nameMatch?.indices} />
                    </span>
                    <span className="truncate text-xs text-(--muted)">
                      <Highlighted text={entry.path} indices={entry.pathMatch?.indices} dim />
                    </span>
                  </span>
                  {entry.file.id === activeFile?.id && (
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-(--line) text-(--muted) shrink-0">
                      open
                    </span>
                  )}
                  {isSel && <CornerDownLeft size={13} className="text-(--muted) shrink-0" />}
                </button>
              </div>
            );
          })}
        </div>

        <div className="flex items-center gap-4 px-5 py-2.5 border-t border-(--line) text-[11px] text-(--muted)">
          <span>↑↓ navigate</span>
          <span>↵ open file</span>
          <span className="ml-auto">Ctrl+P</span>
        </div>
      </div>
    </div>
  );
}

export default QuickOpenHost;
