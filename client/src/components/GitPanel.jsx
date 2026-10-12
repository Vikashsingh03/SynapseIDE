import { useCallback, useEffect, useState } from 'react';
import {
  GitBranch,
  GitCommit,
  ArrowUp,
  ArrowDown,
  Plus,
  RefreshCw,
  ChevronRight,
  History,
  FolderGit2,
  Check,
  X,
  Loader2,
} from 'lucide-react';
import { getThemeClasses } from '../utils/theme';
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

const STATUS_STYLE = {
  modified: { label: 'M', color: 'text-(--blue)' },
  untracked: { label: 'U', color: 'text-(--acid)' },
  added: { label: 'A', color: 'text-emerald-400' },
  deleted: { label: 'D', color: 'text-(--red)' },
  renamed: { label: 'R', color: 'text-(--blue)' },
};

function DiffView({ diff, theme }) {
  const t = getThemeClasses(theme);
  if (!diff) return null;
  return (
    <pre className={`font-mono text-[11px] leading-relaxed p-3 rounded-lg bg-black/30 border ${t.border} overflow-x-auto custom-scrollbar whitespace-pre-wrap max-h-[220px] overflow-y-auto`}>
      {diff.split('\n').map((line, i) => {
        let cls = t.textSecondary;
        if (line.startsWith('+') && !line.startsWith('+++')) cls = 'text-emerald-400';
        else if (line.startsWith('-') && !line.startsWith('---')) cls = 'text-(--red)';
        else if (line.startsWith('@@')) cls = 'text-(--blue)';
        return (
          <span key={i} className={cls}>
            {line}
            {'\n'}
          </span>
        );
      })}
    </pre>
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
  const [showHistory, setShowHistory] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const [s, log] = await Promise.all([gitStatus(roomId), gitLog(roomId)]);
      setStatus(s);
      setCommits(log);
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
      if (result && result.output) setNotice(result.output.slice(0, 300));
      await refresh();
    } catch (e) {
      setError(e.message);
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

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 h-full py-10">
        <Loader2 size={15} className="animate-spin" />
        <span className={`font-mono text-[12px] ${t.textMuted}`}>Reading git status…</span>
      </div>
    );
  }

  // Not a repo yet
  if (status && !status.isRepo) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 h-full py-12 px-6 text-center">
        <span className="w-12 h-12 rounded-2xl bg-(--blue)/10 border border-(--blue)/25 flex items-center justify-center">
          <FolderGit2 size={20} className="text-(--blue)" />
        </span>
        <div>
          <p className={`text-[14px] font-extrabold ${t.textPrimary}`}>No git repository</p>
          <p className={`font-mono text-[11px] ${t.textMuted} mt-1`}>
            {status.files?.length || 0} file(s) in <code className="text-(--acid)">{status.cwd}</code>
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
    <div className="flex flex-col h-full overflow-hidden">
      {/* Branch bar */}
      <div className={`flex items-center gap-2 px-4 py-2.5 border-b ${t.border} shrink-0`}>
        <GitBranch size={14} className="text-(--blue)" />
        <span className={`font-mono text-[13px] font-extrabold ${t.textPrimary}`}>{status?.branch || 'main'}</span>
        {status?.ahead > 0 && (
          <span className={`font-mono text-[11px] ${t.textMuted} flex items-center gap-0.5`}>
            <ArrowUp size={11} /> {status.ahead}
          </span>
        )}
        {status?.behind > 0 && (
          <span className={`font-mono text-[11px] ${t.textMuted} flex items-center gap-0.5`}>
            <ArrowDown size={11} /> {status.behind}
          </span>
        )}
        <span className={`font-mono text-[10px] ${t.textMuted} ml-auto`}>{status?.cwd}</span>
        <button
          onClick={() => run('refresh', refresh)}
          className={t.iconBtn}
          title="Refresh"
        >
          <RefreshCw size={13} className={busy === 'refresh' ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Commit box */}
      <div className={`px-4 py-3 border-b ${t.border} shrink-0`}>
        <div className="flex gap-2">
          <input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && message.trim()) {
                run('commit', () => gitCommit(roomId, message.trim())).then(() => setMessage(''));
              }
            }}
            placeholder="Commit message…"
            className={`flex-1 px-3 py-2 rounded-lg border ${t.border} bg-(--panel) ${t.textPrimary} text-[13px] font-mono outline-none focus:border-(--blue) transition-colors`}
          />
          <button
            onClick={() => run('commit', () => gitCommit(roomId, message.trim())).then(() => setMessage(''))}
            disabled={!message.trim() || !!busy}
            className={`${t.btnPrimary} px-3.5 py-2 text-[13px] flex items-center gap-1.5`}
            title="Stage all & commit"
          >
            {busy === 'commit' ? <Loader2 size={14} className="animate-spin" /> : <GitCommit size={14} />}
            Commit
          </button>
        </div>
        <p className={`font-mono text-[10px] ${t.textMuted} mt-1.5`}>
          Commit stages all changes automatically
        </p>
        {error && <p className="text-[12px] font-bold text-(--red) mt-2">{error}</p>}
        {notice && (
          <p className={`font-mono text-[11px] text-emerald-400 mt-2 whitespace-pre-wrap`}>{notice}</p>
        )}
      </div>

      {/* Push / Pull */}
      <div className={`flex items-center gap-2 px-4 py-2 border-b ${t.border} shrink-0`}>
        <button
          onClick={() => run('push', () => gitPush(roomId))}
          disabled={!!busy}
          className={`${t.btnGhost} px-3 py-1.5 text-[12px] flex items-center gap-1.5`}
        >
          {busy === 'push' ? <Loader2 size={12} className="animate-spin" /> : <ArrowUp size={12} />}
          Push
        </button>
        <button
          onClick={() => run('pull', () => gitPull(roomId))}
          disabled={!!busy}
          className={`${t.btnGhost} px-3 py-1.5 text-[12px] flex items-center gap-1.5`}
        >
          {busy === 'pull' ? <Loader2 size={12} className="animate-spin" /> : <ArrowDown size={12} />}
          Pull
        </button>
        <button
          onClick={() => setShowHistory((v) => !v)}
          className={`${t.btnGhost} px-3 py-1.5 text-[12px] flex items-center gap-1.5 ml-auto ${showHistory ? 'border-(--blue)/40!' : ''}`}
        >
          <History size={12} />
          History
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {showHistory ? (
          <div className="p-3 flex flex-col gap-1">
            {commits.length === 0 ? (
              <p className={`font-mono text-[12px] ${t.textMuted} text-center py-8`}>No commits yet</p>
            ) : (
              commits.map((c) => (
                <div key={c.hash} className={`rounded-lg border ${t.border} bg-(--panel) px-3 py-2.5`}>
                  <p className={`text-[13px] font-bold ${t.textPrimary} leading-snug`}>{c.subject}</p>
                  <p className={`font-mono text-[10px] ${t.textMuted} mt-1`}>
                    {c.author} · {c.date} · <code className="text-(--acid)">{c.hash.slice(0, 7)}</code>
                  </p>
                </div>
              ))
            )}
          </div>
        ) : changes.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-10 px-6 text-center">
            <span className="w-10 h-10 rounded-xl bg-emerald-400/10 border border-emerald-400/25 flex items-center justify-center">
              <Check size={16} className="text-emerald-400" />
            </span>
            <p className={`text-[13px] font-bold ${t.textPrimary}`}>Working tree clean</p>
            <p className={`font-mono text-[11px] ${t.textMuted}`}>No changes to commit</p>
          </div>
        ) : (
          <div className="p-2">
            <p className={`font-mono text-[10px] font-bold uppercase tracking-[0.14em] ${t.textMuted} px-2 py-1.5`}>
              Changes · {changes.length}
            </p>
            {changes.map((ch) => {
              const st = STATUS_STYLE[ch.status] || STATUS_STYLE.modified;
              const isOpen = expandedFile === ch.file;
              return (
                <div key={ch.file} className={`rounded-lg border ${t.border} bg-(--panel) mb-1.5 overflow-hidden`}>
                  <button
                    onClick={() => handleFileClick(ch.file)}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-left"
                  >
                    <ChevronRight
                      size={13}
                      className={`${t.textMuted} transition-transform ${isOpen ? 'rotate-90' : ''}`}
                    />
                    <span className={`font-mono text-[11px] font-extrabold ${st.color} w-4`}>{st.label}</span>
                    <span className={`font-mono text-[12px] ${t.textPrimary} flex-1 truncate`}>{ch.file}</span>
                  </button>
                  {isOpen && (
                    <div className="px-3 pb-3 animate-fade-in">
                      <DiffView diff={diffs[ch.file] || 'Loading diff…'} theme={theme} />
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
