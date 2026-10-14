import { useCallback, useEffect, useState } from 'react';
import {
  GitBranch,
  GitCommit,
  GitMerge,
  ArrowUp,
  ArrowDown,
  Plus,
  RefreshCw,
  ChevronRight,
  ChevronDown,
  History,
  FolderGit2,
  Check,
  Loader2,
  FileDiff,
  Archive,
  Trash2,
  AlertTriangle,
} from 'lucide-react';
import { getThemeClasses } from '../utils/theme';
import { API_BASE } from '../config/apiConfig';
import { getToken } from '../services/authService';
import { useFiles } from '../contexts/FileContext';
import { parseConflicts, applyResolutions } from '../utils/gitConflicts';
import {
  gitStatus,
  gitInit,
  gitAdd,
  gitCommit,
  gitLog,
  gitPush,
  gitPull,
  gitDiff,
} from '../services/gitService';

const STATUS_META = {
  modified: { label: 'M', dot: 'bg-(--blue)', text: 'text-(--blue)' },
  untracked: { label: 'U', dot: 'bg-(--acid)', text: 'text-(--acid)' },
  added: { label: 'A', dot: 'bg-emerald-400', text: 'text-emerald-400' },
  deleted: { label: 'D', dot: 'bg-(--red)', text: 'text-(--red)' },
  renamed: { label: 'R', dot: 'bg-(--blue)', text: 'text-(--blue)' },
};

function DiffView({ diff, theme }) {
  const t = getThemeClasses(theme);
  if (!diff) return null;
  return (
    <div className={`mt-2 rounded-lg bg-black/40 border ${t.border} overflow-hidden`}>
      <pre className="font-mono text-[11px] leading-[1.6] p-3 overflow-x-auto custom-scrollbar whitespace-pre-wrap max-h-[240px] overflow-y-auto custom-scrollbar">
        {diff.split('\n').map((line, i) => {
          let cls = t.textSecondary;
          let bg = '';
          if (line.startsWith('+') && !line.startsWith('+++')) {
            cls = 'text-emerald-300';
            bg = 'bg-emerald-400/8';
          } else if (line.startsWith('-') && !line.startsWith('---')) {
            cls = 'text-red-300';
            bg = 'bg-(--red)/8';
          } else if (line.startsWith('@@')) {
            cls = 'text-(--blue)';
          }
          return (
            <span key={i} className={`${cls} ${bg} block px-1 -mx-1 rounded`}>
              {line || ' '}
            </span>
          );
        })}
      </pre>
    </div>
  );
}

function HistoryList({ commits, theme }) {
  const t = getThemeClasses(theme);
  if (commits.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2.5 py-10 text-center">
        <span className="w-11 h-11 rounded-2xl bg-(--blue)/10 border border-(--blue)/25 flex items-center justify-center">
          <History size={17} className="text-(--blue)" />
        </span>
        <p className={`font-mono text-[12px] ${t.textMuted}`}>No commits yet — make your first one above!</p>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-2 py-2">
      {commits.map((c, i) => (
        <div
          key={c.hash}
          className={`rounded-xl border bg-(--panel) px-4 py-3 transition-all hover:bg-(--panel)/70 ${
            i === 0
              ? 'border-(--acid)/35 shadow-[0_0_20px_-8px_var(--acid)]'
              : `${t.border} hover:border-(--ink)/30`
          }`}
        >
          <div className="flex items-center gap-2.5">
            {i === 0 && (
              <span className="px-1.5 py-0.5 rounded text-[9px] font-extrabold font-mono uppercase tracking-wider bg-(--acid)/15 text-(--acid) border border-(--acid)/30">
                Latest
              </span>
            )}
            <p className={`text-[13.5px] font-extrabold ${t.textPrimary} leading-snug flex-1 truncate`}>
              {c.subject}
            </p>
            <code
              title={c.hash}
              className="shrink-0 px-2 py-1 rounded-lg bg-(--blue)/10 border border-(--blue)/25 text-(--blue) font-mono text-[11px] font-bold"
            >
              {c.hash.slice(0, 7)}
            </code>
          </div>
          <div className={`flex items-center gap-2 mt-2 font-mono text-[11px] ${t.textMuted}`}>
            <span className={`w-5 h-5 rounded-full bg-gradient-to-br from-(--blue)/30 to-(--acid)/30 border ${t.border} inline-flex items-center justify-center text-[9px] font-extrabold ${t.textPrimary}`}>
              {(c.author || '?').slice(0, 1).toUpperCase()}
            </span>
            <span className={`${t.textSecondary} font-bold`}>{c.author}</span>
            <span className="opacity-40">·</span>
            <span>{c.date}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Wave 3: branch/stash/conflict helpers (same auth + API_BASE pattern as gitService) ───

function gitApiHeaders() {
  const token = getToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

// Direct caller for the Wave-3 git endpoints (branches, stash, file-content).
async function gitApi(method, endpoint, { roomId, query, body } = {}) {
  const q = new URLSearchParams();
  if (roomId) q.set('roomId', roomId);
  if (query) for (const [k, v] of Object.entries(query)) q.set(k, v);
  const qs = q.toString();
  const res = await fetch(`${API_BASE}/git${endpoint}${qs ? `?${qs}` : ''}`, {
    method,
    headers: gitApiHeaders(),
    body: method === 'POST' ? JSON.stringify({ roomId, ...(body || {}) }) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Git operation failed.');
  return data;
}

const BRANCH_NAME_RE = /^[A-Za-z0-9][A-Za-z0-9._/-]*$/;
function validBranchName(name) {
  const s = String(name || '');
  return s.length > 0 && s.length <= 120 && BRANCH_NAME_RE.test(s) && !s.includes('..');
}

// Porcelain codes for conflicted files: UU, AA, DD, AU, UA, UD, DU
function isConflicted(change) {
  const code = String(change?.code || '');
  return code.includes('U') || code === 'AA' || code === 'DD';
}

// Best-effort match of a git working-tree path to an open editor file
// (FileContext files live in localStorage/Yjs and may not mirror disk).
function findMatchingEditorFile(files, gitPath) {
  if (!files || !gitPath) return null;
  const byId = new Map(files.map((f) => [f.id, f]));
  const relPath = (f) => {
    const parts = [f.name];
    const seen = new Set();
    let p = f;
    while (p.parentId && byId.get(p.parentId) && !seen.has(p.parentId)) {
      seen.add(p.parentId);
      p = byId.get(p.parentId);
      parts.unshift(p.name);
    }
    return parts.join('/');
  };
  const base = String(gitPath).split('/').pop();
  return (
    files.find((f) => f.type === 'file' && relPath(f) === gitPath) ||
    files.find((f) => f.type === 'file' && f.name === base) ||
    null
  );
}

function ConflictResolver({ roomId, file, theme, onResolved, onEditorSync }) {
  const t = getThemeClasses(theme);
  const [content, setContent] = useState(null);
  const [loadErr, setLoadErr] = useState('');
  const [choices, setChoices] = useState({});
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState('');

  useEffect(() => {
    let alive = true;
    setContent(null);
    setChoices({});
    setLoadErr('');
    (async () => {
      try {
        const data = await gitApi('GET', '/file-content', { roomId, query: { file } });
        if (alive) setContent(data.content ?? '');
      } catch (e) {
        if (alive) setLoadErr(e.message);
      }
    })();
    return () => {
      alive = false;
    };
  }, [roomId, file]);

  const parsed = content == null ? null : parseConflicts(content);
  const allChosen = parsed && parsed.hasConflicts && parsed.hunks.every((h) => choices[h.index]);

  const apply = async () => {
    if (!allChosen || saving) return;
    setSaving(true);
    setSaveErr('');
    try {
      const resolved = applyResolutions(content, choices);
      await gitApi('POST', '/file-content', { roomId, body: { file, content: resolved } });
      // Mark the conflict resolved in the index (existing stage mechanism)
      await gitAdd(roomId, [file]);
      // Refresh the open editor copy if one matches (best-effort)
      if (onEditorSync) {
        try {
          await onEditorSync(file, resolved);
        } catch {}
      }
      onResolved();
    } catch (e) {
      setSaveErr(e.message);
    } finally {
      setSaving(false);
    }
  };

  const sideBtn = (hunkIdx, side, label) => (
    <button
      key={side}
      onClick={() => setChoices((p) => ({ ...p, [hunkIdx]: side }))}
      className={`flex-1 px-2.5 py-1.5 rounded-lg font-mono text-[11px] font-extrabold border transition-all ${
        choices[hunkIdx] === side
          ? 'bg-(--ink) text-(--paper) border-(--ink) shadow-sm'
          : `${t.border} ${t.textMuted} hover:${t.textPrimary} bg-(--panel)`
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className={`mt-2 rounded-xl border ${t.border} bg-black/30 p-3`}>
      {content == null && !loadErr && (
        <div className="flex items-center gap-2 py-4 justify-center">
          <Loader2 size={14} className="animate-spin text-(--blue)" />
          <span className={`font-mono text-[11.5px] ${t.textMuted}`}>Reading {file}…</span>
        </div>
      )}
      {loadErr && <p className="text-[12px] font-bold text-(--red)">{loadErr}</p>}
      {parsed && !parsed.hasConflicts && (
        <p className={`font-mono text-[11.5px] ${t.textMuted}`}>
          No conflict markers found — this file may already be resolved.
        </p>
      )}
      {parsed &&
        parsed.hunks.map((h) => (
          <div key={h.index} className={`rounded-lg border ${t.border} bg-(--panel) p-2.5 mb-2 last:mb-0`}>
            <p className={`font-mono text-[10.5px] font-extrabold uppercase tracking-wider ${t.textMuted} mb-2`}>
              Conflict {h.index + 1} · line {h.startLine}
            </p>
            <div className="flex flex-col gap-1.5">
              <div className="rounded-lg border border-(--blue)/30 bg-(--blue)/8 p-2">
                <p className="font-mono text-[10px] font-extrabold text-(--blue) uppercase tracking-wide mb-1">
                  Current{h.currentLabel ? ` · ${h.currentLabel}` : ''}
                </p>
                <pre className={`font-mono text-[11px] leading-[1.55] ${t.textPrimary} whitespace-pre-wrap`}>
                  {h.current.length ? h.current.join('\n') : <span className={t.textMuted}>(empty)</span>}
                </pre>
              </div>
              {h.base && (
                <div className={`rounded-lg border ${t.border} bg-black/20 p-2`}>
                  <p className={`font-mono text-[10px] font-extrabold ${t.textMuted} uppercase tracking-wide mb-1`}>
                    Base (diff3)
                  </p>
                  <pre className={`font-mono text-[11px] leading-[1.55] ${t.textMuted} whitespace-pre-wrap`}>
                    {h.base.length ? h.base.join('\n') : '(empty)'}
                  </pre>
                </div>
              )}
              <div className="rounded-lg border border-emerald-400/30 bg-emerald-400/8 p-2">
                <p className="font-mono text-[10px] font-extrabold text-emerald-400 uppercase tracking-wide mb-1">
                  Incoming{h.incomingLabel ? ` · ${h.incomingLabel}` : ''}
                </p>
                <pre className={`font-mono text-[11px] leading-[1.55] ${t.textPrimary} whitespace-pre-wrap`}>
                  {h.incoming.length ? h.incoming.join('\n') : <span className={t.textMuted}>(empty)</span>}
                </pre>
              </div>
            </div>
            <div className="flex gap-1.5 mt-2">
              {sideBtn(h.index, 'current', 'Current')}
              {sideBtn(h.index, 'incoming', 'Incoming')}
              {sideBtn(h.index, 'both', 'Both')}
            </div>
          </div>
        ))}
      {parsed && parsed.hasConflicts && (
        <div className="mt-2.5 flex items-center gap-2">
          <button
            onClick={apply}
            disabled={!allChosen || saving}
            className={`${t.btnPrimary} px-3.5 py-1.5 text-[12px] rounded-lg! flex items-center gap-1.5 disabled:opacity-40`}
          >
            {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
            Apply resolutions
          </button>
          {!allChosen && (
            <span className={`font-mono text-[10.5px] ${t.textMuted}`}>
              Pick a side for every conflict first
            </span>
          )}
        </div>
      )}
      {saveErr && <p className="text-[12px] font-bold text-(--red) mt-2">{saveErr}</p>}
    </div>
  );
}

export default function GitPanel({ theme, roomId }) {
  const t = getThemeClasses(theme);
  const [status, setStatus] = useState(null);
  const [commits, setCommits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [expandedFile, setExpandedFile] = useState(null);
  const [diffs, setDiffs] = useState({});
  const [view, setView] = useState('changes'); // 'changes' | 'history'

  // ─── Wave 3: branches / stash / conflicts ───
  const [branches, setBranches] = useState([]);
  const [branchOpen, setBranchOpen] = useState(false);
  const [newBranch, setNewBranch] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [stashes, setStashes] = useState([]);
  const [stashOpen, setStashOpen] = useState(false);
  const [resolvingFile, setResolvingFile] = useState(null);

  // Editor file sync for the conflict resolver (best-effort; panel always sits inside FileProvider)
  let editorFiles = null;
  let editorUpdateContent = null;
  try {
    const ctx = useFiles();
    editorFiles = ctx.files;
    editorUpdateContent = ctx.updateContent;
  } catch {}

  const refresh = useCallback(async () => {
    try {
      const [s, log, br, st] = await Promise.all([
        gitStatus(roomId),
        gitLog(roomId),
        gitApi('GET', '/branches', { roomId }).catch(() => ({ branches: [] })),
        gitApi('POST', '/stash', { roomId, body: { action: 'list' } }).catch(() => ({ stashes: [] })),
      ]);
      setStatus(s);
      setCommits(log);
      setBranches(br.branches || []);
      setStashes(st.stashes || []);
      setError('');
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [roomId]);

  useEffect(() => {
    setLoading(true);
    refresh();
  }, [refresh]);

  const run = async (label, fn) => {
    setBusy(label);
    setError('');
    setNotice('');
    try {
      const result = await fn();
      if (result && result.output) {
        // Show only the commit summary line, not the full diff stat
        const firstLine = String(result.output).split('\n').find((l) => l.includes(']')) || 'Done!';
        setNotice(firstLine.trim().slice(0, 120));
      }
      await refresh();
      return true;
    } catch (e) {
      setError(e.message);
      return false;
    } finally {
      setBusy('');
    }
  };

  const handleFileClick = async (file) => {
    if (expandedFile === file) {
      setExpandedFile(null);
      return;
    }
    setExpandedFile(file);
    if (!diffs[file]) {
      try {
        const d = await gitDiff(roomId, file);
        setDiffs((prev) => ({ ...prev, [file]: d }));
      } catch {}
    }
  };

  const doCommit = () => {
    if (!message.trim() || busy) return;
    run('commit', () => gitCommit(roomId, message.trim())).then(() => setMessage(''));
  };

  // ─── Wave 3: branch ops ───
  const createBranch = () => {
    const name = newBranch.trim();
    if (!validBranchName(name) || busy) return;
    run('branch-create', () => gitApi('POST', '/branch/create', { roomId, body: { name } })).then((ok) => {
      if (!ok) return;
      setNewBranch('');
      setNotice(`Branch "${name}" created.`);
    });
  };

  const checkoutBranch = (name) => {
    if (busy) return;
    run('branch-checkout', () => gitApi('POST', '/branch/checkout', { roomId, body: { name } })).then((ok) => {
      if (ok) setNotice(`Switched to "${name}".`);
    });
  };

  const deleteBranch = (name) => {
    if (busy) return;
    if (confirmDelete !== name) {
      setConfirmDelete(name);
      return;
    }
    setConfirmDelete(null);
    run('branch-delete', () => gitApi('POST', '/branch/delete', { roomId, body: { name } })).then((ok) => {
      if (ok) setNotice(`Branch "${name}" deleted.`);
    });
  };

  // ─── Wave 3: stash ops ───
  const pushStash = () => {
    if (busy) return;
    run('stash-push', () => gitApi('POST', '/stash', { roomId, body: { action: 'push' } })).then((ok) => {
      if (ok) setNotice('Changes stashed.');
    });
  };

  const popStash = (index) => {
    if (busy) return;
    run('stash-pop', () =>
      gitApi('POST', '/stash', { roomId, body: { action: 'pop', index } })
    ).then((ok) => {
      if (ok) setNotice('Stash applied.');
    });
  };

  // ─── Wave 3: conflict resolver editor sync (solo only — rooms bind via Yjs) ───
  const syncEditorFile = async (gitPath, resolvedContent) => {
    if (roomId) return; // rooms: git working tree is the source of truth; editor syncs via Yjs
    const match = findMatchingEditorFile(editorFiles, gitPath);
    if (match && editorUpdateContent) {
      editorUpdateContent(match.id, resolvedContent);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 h-full min-h-[120px]">
        <Loader2 size={15} className="animate-spin text-(--blue)" />
        <span className={`font-mono text-[12px] ${t.textMuted}`}>Reading git status…</span>
      </div>
    );
  }

  // ─── Not a repo yet ───
  if (status && !status.isRepo) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 h-full min-h-[160px] px-6 text-center">
        <span className="w-12 h-12 rounded-2xl bg-(--blue)/10 border border-(--blue)/25 flex items-center justify-center">
          <FolderGit2 size={20} className="text-(--blue)" />
        </span>
        <div>
          <p className={`text-[14px] font-extrabold ${t.textPrimary}`}>No git repository here</p>
          <p className={`font-mono text-[11px] ${t.textMuted} mt-1`}>
            {status.files?.length || 0} file(s) in <code className="text-(--acid) font-bold">{status.cwd}</code>
          </p>
        </div>
        <button
          onClick={() => run('init', () => gitInit(roomId))}
          disabled={!!busy}
          className={`${t.btnPrimary} px-4 py-2 text-[13px] flex items-center gap-1.5`}
        >
          {busy === 'init' ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
          Initialize repository
        </button>
        {error && <p className="text-[12px] font-bold text-(--red)">{error}</p>}
      </div>
    );
  }

  const changes = status?.changes || [];

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* ─── Top bar: branch + actions ─── */}
      <div className={`flex items-center gap-2 px-4 py-2 border-b ${t.border} shrink-0 bg-(--panel)/50`}>
        {/* ─── Wave 3: branch switcher dropdown ─── */}
        <div className="relative">
          <button
            onClick={() => {
              setBranchOpen((v) => !v);
              setConfirmDelete(null);
            }}
            title="Switch branch"
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-(--blue)/10 border border-(--blue)/25 hover:border-(--blue)/60 transition-colors"
          >
            {busy === 'branch-checkout' ? (
              <Loader2 size={12} className="animate-spin text-(--blue)" />
            ) : (
              <GitBranch size={12} className="text-(--blue)" />
            )}
            <span className={`font-mono text-[12px] font-extrabold ${t.textPrimary}`}>{status?.branch || 'main'}</span>
            <ChevronDown size={11} className={`${t.textMuted} transition-transform ${branchOpen ? 'rotate-180' : ''}`} />
          </button>
          {branchOpen && (
            <>
              <div className="fixed inset-0 z-20 cursor-default" onClick={() => setBranchOpen(false)} />
              <div
                className={`absolute left-0 top-full mt-2 z-30 w-64 rounded-xl border ${t.border} bg-(--panel) shadow-2xl p-2 animate-fade-in`}
              >
                <div className="flex gap-1.5 p-1">
                  <input
                    value={newBranch}
                    onChange={(e) => setNewBranch(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && createBranch()}
                    placeholder="New branch name…"
                    className={`flex-1 min-w-0 bg-transparent outline-none ${t.textPrimary} text-[12px] font-mono px-2 py-1.5 rounded-lg border ${t.border} focus:border-(--blue)/60 placeholder:${t.textMuted}`}
                  />
                  <button
                    onClick={createBranch}
                    disabled={!validBranchName(newBranch.trim()) || !!busy}
                    title="Create branch"
                    className={`${t.btnPrimary} px-2.5 rounded-lg! disabled:opacity-40`}
                  >
                    {busy === 'branch-create' ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
                  </button>
                </div>
                <div className="max-h-56 overflow-y-auto custom-scrollbar mt-1">
                  {branches.map((b) => (
                    <div
                      key={b.name}
                      className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg transition-colors group ${
                        b.current ? 'bg-(--acid)/10' : 'hover:bg-(--ink)/5'
                      }`}
                    >
                      <button
                        onClick={() => {
                          if (!b.current) checkoutBranch(b.name);
                        }}
                        title={b.current ? 'Current branch' : `Switch to ${b.name}`}
                        className="flex-1 min-w-0 flex items-center gap-2 text-left"
                      >
                        {b.current ? (
                          <Check size={13} className="text-(--acid) shrink-0" />
                        ) : (
                          <GitBranch size={13} className={`${t.textMuted} shrink-0`} />
                        )}
                        <span
                          className={`font-mono text-[12px] truncate ${
                            b.current ? `font-extrabold ${t.textPrimary}` : t.textSecondary
                          }`}
                        >
                          {b.name}
                        </span>
                      </button>
                      {!b.current &&
                        (confirmDelete === b.name ? (
                          <button
                            onClick={() => deleteBranch(b.name)}
                            title="Click again to confirm"
                            className="shrink-0 px-2 py-1 rounded-md bg-(--red)/15 border border-(--red)/40 text-(--red) font-mono text-[10px] font-extrabold uppercase"
                          >
                            {busy === 'branch-delete' ? <Loader2 size={11} className="animate-spin" /> : 'Sure?'}
                          </button>
                        ) : (
                          <button
                            onClick={() => deleteBranch(b.name)}
                            title={`Delete ${b.name}`}
                            className="shrink-0 p-1 rounded-md opacity-0 group-hover:opacity-100 hover:bg-(--red)/10 transition-all"
                          >
                            <Trash2 size={13} className="text-(--red)" />
                          </button>
                        ))}
                    </div>
                  ))}
                  {branches.length === 0 && (
                    <p className={`font-mono text-[11px] ${t.textMuted} px-2 py-2`}>No branches yet</p>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
        {(status?.ahead > 0 || status?.behind > 0) && (
          <span className={`font-mono text-[11px] ${t.textMuted} flex items-center gap-1.5`}>
            {status.ahead > 0 && <span className="flex items-center gap-0.5"><ArrowUp size={11} />{status.ahead}</span>}
            {status.behind > 0 && <span className="flex items-center gap-0.5"><ArrowDown size={11} />{status.behind}</span>}
          </span>
        )}
        <span className={`font-mono text-[10px] ${t.textMuted} ml-auto hidden sm:block`}>{status?.cwd}</span>

        <div className="flex items-center gap-1 ml-auto sm:ml-2">
          <button
            onClick={() => run('push', () => gitPush(roomId))}
            disabled={!!busy}
            title="Push to remote"
            className={`${t.iconBtn} flex items-center gap-1 px-2! font-mono text-[11px]!`}
          >
            {busy === 'push' ? <Loader2 size={12} className="animate-spin" /> : <ArrowUp size={12} />}
            <span className="hidden md:inline">Push</span>
          </button>
          <button
            onClick={() => run('pull', () => gitPull(roomId))}
            disabled={!!busy}
            title="Pull from remote"
            className={`${t.iconBtn} flex items-center gap-1 px-2! font-mono text-[11px]!`}
          >
            {busy === 'pull' ? <Loader2 size={12} className="animate-spin" /> : <ArrowDown size={12} />}
            <span className="hidden md:inline">Pull</span>
          </button>
          <button
            onClick={() => run('refresh', refresh)}
            title="Refresh status"
            className={t.iconBtn}
          >
            <RefreshCw size={13} className={busy === 'refresh' ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* ─── Commit bar ─── */}
      <div className={`px-4 pt-3 pb-2.5 shrink-0`}>
        <div className={`flex gap-2 p-1.5 rounded-xl border ${t.border} bg-(--panel) focus-within:border-(--blue)/50 transition-colors`}>
          <GitCommit size={15} className={`${t.textMuted} ml-1.5 mt-2 shrink-0`} />
          <input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && doCommit()}
            placeholder="Commit message… (Enter to commit)"
            className={`flex-1 bg-transparent outline-none ${t.textPrimary} text-[13px] font-mono py-1.5 placeholder:${t.textMuted}`}
          />
          <button
            onClick={doCommit}
            disabled={!message.trim() || !!busy}
            className={`${t.btnPrimary} px-4 py-1.5 text-[12.5px] rounded-lg! flex items-center gap-1.5 disabled:opacity-40`}
          >
            {busy === 'commit' ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
            Commit
          </button>
        </div>
        {error && (
          <p className="text-[12px] font-bold text-(--red) mt-2 flex items-center gap-1.5 animate-fade-in">
            <span className="w-1.5 h-1.5 rounded-full bg-(--red)" />{error}
          </p>
        )}
        {notice && (
          <p className="font-mono text-[11.5px] text-emerald-400 mt-2 flex items-center gap-1.5 animate-fade-in">
            <Check size={12} />{notice}
          </p>
        )}
      </div>

      {/* ─── Wave 3: stash row ─── */}
      {(stashes.length > 0 || changes.length > 0) && (
        <div className="px-4 pb-2 shrink-0">
          <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border ${t.border} bg-(--panel)/60`}>
            <button
              onClick={pushStash}
              disabled={changes.length === 0 || !!busy}
              title="Stash all working-tree changes"
              className={`${t.iconBtn} flex items-center gap-1.5 px-2.5! font-mono text-[11px]! font-bold! disabled:opacity-40`}
            >
              {busy === 'stash-push' ? <Loader2 size={12} className="animate-spin" /> : <Archive size={13} />}
              Stash changes
            </button>
            {stashes.length > 0 && (
              <button
                onClick={() => setStashOpen((v) => !v)}
                className={`flex items-center gap-1 font-mono text-[11px] font-bold ${t.textMuted} hover:${t.textPrimary} transition-colors`}
              >
                {stashes.length} stashed
                <ChevronRight size={13} className={`transition-transform ${stashOpen ? 'rotate-90' : ''}`} />
              </button>
            )}
            <span className={`font-mono text-[10px] ${t.textMuted} ml-auto hidden lg:block opacity-70`}>
              Stashes survive branch switches
            </span>
          </div>
          {stashOpen && stashes.length > 0 && (
            <div className="mt-1.5 flex flex-col gap-1 animate-fade-in">
              {stashes.map((s) => (
                <div
                  key={s.index}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${t.border} bg-(--panel)`}
                >
                  <Archive size={12} className={`${t.textMuted} shrink-0`} />
                  <span className={`font-mono text-[11.5px] ${t.textPrimary} flex-1 min-w-0 truncate`} title={s.message}>
                    {s.message}
                  </span>
                  <span className={`font-mono text-[10px] ${t.textMuted} shrink-0`}>stash@{'{'}{s.index}{'}'}</span>
                  <button
                    onClick={() => popStash(s.index)}
                    disabled={!!busy}
                    title={`Apply stash@{${s.index}}`}
                    className={`${t.iconBtn} px-2.5! py-1! font-mono text-[10.5px]! font-extrabold! uppercase! disabled:opacity-40`}
                  >
                    {busy === 'stash-pop' ? <Loader2 size={11} className="animate-spin" /> : 'Pop'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─── View switcher ─── */}
      <div className={`flex items-center gap-1 px-4 pb-2 shrink-0`}>
        <div className={`flex p-0.5 rounded-lg border ${t.border} bg-(--panel)`}>
          {[
            { id: 'changes', label: `Changes${changes.length ? ` · ${changes.length}` : ''}`, icon: FileDiff },
            { id: 'history', label: `History${commits.length ? ` · ${commits.length}` : ''}`, icon: History },
          ].map((v) => (
            <button
              key={v.id}
              onClick={() => setView(v.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-mono text-[11px] font-bold transition-all ${
                view === v.id
                  ? 'bg-(--ink) text-(--paper) shadow-sm'
                  : `${t.textMuted} hover:${t.textPrimary}`
              }`}
            >
              <v.icon size={12} />
              {v.label}
            </button>
          ))}
        </div>
      </div>

      {/* ─── Scrollable content ─── */}
      <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar px-4 pb-4">
        {view === 'history' ? (
          <HistoryList commits={commits} theme={theme} />
        ) : changes.length === 0 ? (
          <div className="flex flex-col items-center gap-2.5 py-8 text-center">
            <span className="w-11 h-11 rounded-2xl bg-emerald-400/10 border border-emerald-400/25 flex items-center justify-center">
              <Check size={17} className="text-emerald-400" />
            </span>
            <div>
              <p className={`text-[13.5px] font-extrabold ${t.textPrimary}`}>Working tree clean</p>
              <p className={`font-mono text-[11px] ${t.textMuted} mt-0.5`}>Edit a file and it&apos;ll show up here</p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-1.5 py-1">
            {changes.map((ch) => {
              const meta = STATUS_META[ch.status] || STATUS_META.modified;
              const isOpen = expandedFile === ch.file;
              const conflicted = isConflicted(ch);
              const resolving = resolvingFile === ch.file;
              return (
                <div
                  key={ch.file}
                  className={`rounded-xl border bg-(--panel) overflow-hidden transition-colors ${
                    conflicted
                      ? 'border-(--red)/40'
                      : isOpen
                        ? 'border-(--blue)/35'
                        : `${t.border} hover:border-(--ink)/25`
                  }`}
                >
                  <button
                    onClick={() => handleFileClick(ch.file)}
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left"
                  >
                    <span className={`w-5 h-5 rounded-md ${meta.dot}/15 flex items-center justify-center shrink-0`}>
                      <span className={`font-mono text-[10px] font-extrabold ${meta.text}`}>{meta.label}</span>
                    </span>
                    <span className={`font-mono text-[12.5px] ${t.textPrimary} flex-1 truncate font-medium`}>{ch.file}</span>
                    {conflicted && (
                      <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-(--red)/12 border border-(--red)/40 text-(--red) font-mono text-[10px] font-extrabold uppercase tracking-wide shrink-0">
                        <AlertTriangle size={10} />
                        Conflict
                      </span>
                    )}
                    <ChevronRight
                      size={14}
                      className={`${t.textMuted} transition-transform duration-150 ${isOpen ? 'rotate-90' : ''}`}
                    />
                  </button>
                  {conflicted && (
                    <div className="px-3 pb-2.5">
                      <button
                        onClick={() => setResolvingFile(resolving ? null : ch.file)}
                        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg font-mono text-[11px] font-extrabold border transition-all ${
                          resolving
                            ? 'bg-(--ink) text-(--paper) border-(--ink)'
                            : 'border-(--red)/40 text-(--red) bg-(--red)/8 hover:bg-(--red)/15'
                        }`}
                      >
                        <GitMerge size={12} />
                        {resolving ? 'Hide resolver' : 'Resolve'}
                      </button>
                    </div>
                  )}
                  {isOpen && (
                    <div className="px-3 pb-3 animate-fade-in">
                      <DiffView diff={diffs[ch.file] || 'Loading diff…'} theme={theme} />
                    </div>
                  )}
                  {resolving && conflicted && (
                    <div className="px-3 pb-3 animate-fade-in">
                      <ConflictResolver
                        roomId={roomId}
                        file={ch.file}
                        theme={theme}
                        onEditorSync={syncEditorFile}
                        onResolved={() => {
                          setResolvingFile(null);
                          refresh();
                        }}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
