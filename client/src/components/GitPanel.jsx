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
  Loader2,
  FileDiff,
} from 'lucide-react';
import { getThemeClasses } from '../utils/theme';
import {
  gitStatus,
  gitInit,
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
      if (result && result.output) {
        // Show only the commit summary line, not the full diff stat
        const firstLine = String(result.output).split('\n').find((l) => l.includes(']')) || 'Done!';
        setNotice(firstLine.trim().slice(0, 120));
      }
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

  const doCommit = () => {
    if (!message.trim() || busy) return;
    run('commit', () => gitCommit(roomId, message.trim())).then(() => setMessage(''));
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
        <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-(--blue)/10 border border-(--blue)/25">
          <GitBranch size={12} className="text-(--blue)" />
          <span className={`font-mono text-[12px] font-extrabold ${t.textPrimary}`}>{status?.branch || 'main'}</span>
        </span>
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
              return (
                <div
                  key={ch.file}
                  className={`rounded-xl border ${t.border} bg-(--panel) overflow-hidden transition-colors ${isOpen ? 'border-(--blue)/35' : 'hover:border-(--ink)/25'}`}
                >
                  <button
                    onClick={() => handleFileClick(ch.file)}
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left"
                  >
                    <span className={`w-5 h-5 rounded-md ${meta.dot}/15 flex items-center justify-center shrink-0`}>
                      <span className={`font-mono text-[10px] font-extrabold ${meta.text}`}>{meta.label}</span>
                    </span>
                    <span className={`font-mono text-[12.5px] ${t.textPrimary} flex-1 truncate font-medium`}>{ch.file}</span>
                    <ChevronRight
                      size={14}
                      className={`${t.textMuted} transition-transform duration-150 ${isOpen ? 'rotate-90' : ''}`}
                    />
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
