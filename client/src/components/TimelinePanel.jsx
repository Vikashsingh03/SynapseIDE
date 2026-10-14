import { useState, useEffect, useMemo } from 'react';
import { History, RotateCcw, X, FileText } from 'lucide-react';
import { useFiles } from '../contexts/FileContext';
import { getSnapshots, recordSnapshot } from '../history/historyStore';
import { diffLines } from '../utils/simpleDiff';

function timeAgo(ts) {
  const s = Math.max(1, Math.floor((Date.now() - ts) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(ts).toLocaleDateString();
}

function firstLinePreview(content) {
  const line = String(content).split('\n')[0] || '';
  return line.length > 80 ? line.slice(0, 80) + '…' : line;
}

// Collapse runs of >6 unchanged lines into one summary row.
function collapseOps(ops) {
  const out = [];
  let run = [];
  const flush = () => {
    if (run.length > 6) {
      out.push({ type: 'gap', count: run.length });
    } else {
      out.push(...run);
    }
    run = [];
  };
  for (const op of ops) {
    if (op.type === 'same') run.push(op);
    else {
      flush();
      out.push(op);
    }
  }
  flush();
  return out;
}

function SnapshotDiff({ snap, current }) {
  const ops = useMemo(() => diffLines(snap.content, current), [snap, current]);
  if (ops === null) {
    return (
      <p className="font-mono text-[12px] text-amber-400">
        File too large to diff — view Content instead.
      </p>
    );
  }
  if (!ops.length || ops.every((o) => o.type === 'same')) {
    return (
      <p className="font-mono text-[12px] text-slate-500">
        No differences — this version matches the current content.
      </p>
    );
  }
  const rows = collapseOps(ops);
  return (
    <pre className="font-mono text-[12px] leading-5 whitespace-pre-wrap break-words">
      {rows.map((op, i) =>
        op.type === 'gap' ? (
          <div key={i} className="text-slate-600 select-none">
            ⋯ {op.count} unchanged lines
          </div>
        ) : (
          <div
            key={i}
            className={
              op.type === 'del'
                ? 'bg-red-500/[0.13] text-red-200'
                : op.type === 'add'
                  ? 'bg-lime-400/[0.13] text-lime-100'
                  : 'text-slate-400'
            }
          >
            <span className="inline-block w-4 text-slate-600 select-none">
              {op.type === 'del' ? '−' : op.type === 'add' ? '+' : ' '}
            </span>
            {op.text || ' '}
          </div>
        )
      )}
    </pre>
  );
}

export default function TimelinePanel({ onClose }) {
  const { activeFile, updateContent } = useFiles();
  const [snapshots, setSnapshots] = useState([]);
  const [selectedAt, setSelectedAt] = useState(null);
  const [tab, setTab] = useState('content'); // 'content' | 'diff'
  const [confirmRestore, setConfirmRestore] = useState(false);
  const [restored, setRestored] = useState(false);

  useEffect(() => {
    if (!activeFile?.id) {
      setSnapshots([]);
      return;
    }
    setSnapshots(getSnapshots(activeFile.id));
    setSelectedAt(null);
    setTab('content');
    setConfirmRestore(false);
    setRestored(false);
  }, [activeFile?.id]);

  const selected = snapshots.find((s) => s.at === selectedAt) || null;

  const handleRestore = () => {
    if (!selected || !activeFile) return;
    if (!confirmRestore) {
      setConfirmRestore(true);
      return;
    }
    try {
      // Keep a snapshot of the pre-restore content so the restore itself
      // can be undone from the Timeline.
      recordSnapshot(activeFile.id, activeFile.content || '');
    } catch {}
    updateContent(activeFile.id, selected.content);
    setRestored(true);
    setConfirmRestore(false);
    setSnapshots(getSnapshots(activeFile.id));
  };

  return (
    <div className="fixed inset-y-0 right-0 w-[560px] max-w-[96vw] z-[70] bg-[#0B0F16] border-l border-white/[0.08] text-slate-200 flex flex-col animate-fade-in">
      <div className="h-12 shrink-0 flex items-center gap-2.5 px-4 border-b border-white/[0.07]">
        <span className="w-8 h-8 rounded-lg bg-[#58A6FF]/15 text-[#58A6FF] flex items-center justify-center">
          <History size={16} />
        </span>
        <div className="min-w-0">
          <div className="text-[13px] font-bold leading-tight">Timeline</div>
          <div className="font-mono text-[11px] text-slate-500 truncate">
            {activeFile?.name || 'no file open'}
          </div>
        </div>
        <button
          onClick={onClose}
          className="ml-auto w-8 h-8 rounded-lg hover:bg-white/10 flex items-center justify-center text-slate-400"
          title="Close"
        >
          <X size={15} />
        </button>
      </div>

      {!activeFile ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-[13px] text-slate-500">Open a file to see its history.</p>
        </div>
      ) : snapshots.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-2 text-center px-8">
          <FileText size={28} className="text-slate-600" />
          <p className="text-[13px] font-bold">No history yet</p>
          <p className="text-[12px] text-slate-500">
            Versions appear here as you edit — the first snapshot lands within a few
            seconds of your first change.
          </p>
        </div>
      ) : (
        <>
          <div className="flex-1 min-h-0 flex">
            <div className="w-[200px] shrink-0 border-r border-white/[0.06] overflow-y-auto">
              {[...snapshots].reverse().map((s) => (
                <button
                  key={s.at}
                  onClick={() => {
                    setSelectedAt(s.at);
                    setConfirmRestore(false);
                    setRestored(false);
                  }}
                  className={`w-full text-left px-3.5 py-2.5 border-b border-white/[0.04] hover:bg-white/[0.03] transition-colors ${
                    selectedAt === s.at ? 'bg-[#58A6FF]/[0.08]' : ''
                  }`}
                >
                  <div className="text-[12px] font-bold text-slate-200">{timeAgo(s.at)}</div>
                  <div className="font-mono text-[10.5px] text-slate-500 truncate">
                    {firstLinePreview(s.content) || '(empty preview)'}
                  </div>
                </button>
              ))}
            </div>

            <div className="flex-1 min-w-0 flex flex-col">
              {!selected ? (
                <div className="flex-1 flex items-center justify-center">
                  <p className="text-[12.5px] text-slate-500">Select a version to preview it.</p>
                </div>
              ) : (
                <>
                  <div className="px-4 pt-3 flex items-center gap-2">
                    <div className="flex rounded-lg overflow-hidden border border-white/[0.08] text-[11.5px] font-bold">
                      {['content', 'diff'].map((t) => (
                        <button
                          key={t}
                          onClick={() => setTab(t)}
                          className={`px-3 py-1.5 capitalize ${
                            tab === t ? 'bg-[#58A6FF]/20 text-[#58A6FF]' : 'text-slate-500 hover:bg-white/5'
                          }`}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                    <button
                      onClick={handleRestore}
                      className={`ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11.5px] font-bold border transition-colors ${
                        confirmRestore
                          ? 'border-red-400/50 bg-red-500/15 text-red-200'
                          : restored
                            ? 'border-emerald-400/50 bg-emerald-500/10 text-emerald-300'
                            : 'border-white/[0.1] hover:bg-white/[0.06] text-slate-300'
                      }`}
                    >
                      <RotateCcw size={13} />
                      {restored ? 'Restored ✓' : confirmRestore ? 'Click again to confirm' : 'Restore this version'}
                    </button>
                  </div>
                  <div className="flex-1 min-h-0 overflow-y-auto p-4">
                    {tab === 'content' ? (
                      <pre className="font-mono text-[12px] leading-5 text-slate-300 whitespace-pre-wrap break-words">
                        {selected.content}
                      </pre>
                    ) : (
                      <SnapshotDiff snap={selected} current={activeFile.content || ''} />
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export function TimelineHost() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener('synapse:open-timeline', onOpen);
    return () => window.removeEventListener('synapse:open-timeline', onOpen);
  }, []);
  if (!open) return null;
  return <TimelinePanel onClose={() => setOpen(false)} />;
}
