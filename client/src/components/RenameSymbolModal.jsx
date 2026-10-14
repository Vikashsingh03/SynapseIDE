import { useEffect, useMemo, useRef, useState } from 'react';
import { X, Replace } from 'lucide-react';
import { useFiles } from '../contexts/FileContext';
import FileIcon from './FileIcon';
import { isValidIdentifier, buildRenamePlan } from '../utils/projectRename';

export default function RenameSymbolModal({ open, onClose, seedWord = '' }) {
  const { files, updateContent } = useFiles();
  const [oldName, setOldName] = useState('');
  const [newName, setNewName] = useState('');
  const [armed, setArmed] = useState(false);
  const [applied, setApplied] = useState(false);
  const [status, setStatus] = useState('');
  const closeTimer = useRef(null);

  // Reset fields each time the modal opens; the host may prefill the old name.
  useEffect(() => {
    if (open) {
      setOldName(seedWord || '');
      setNewName('');
      setArmed(false);
      setApplied(false);
      setStatus('');
    }
    return () => {
      if (closeTimer.current) {
        clearTimeout(closeTimer.current);
        closeTimer.current = null;
      }
    };
  }, [open, seedWord]);

  // Esc closes
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const oldTrimmed = oldName.trim();
  const newTrimmed = newName.trim();
  const oldValid = isValidIdentifier(oldTrimmed);
  const newValid = isValidIdentifier(newTrimmed) && newTrimmed !== oldTrimmed;

  const plan = useMemo(
    () => buildRenamePlan(files, oldTrimmed, newTrimmed),
    [files, oldTrimmed, newTrimmed]
  );

  if (!open) return null;

  const doClose = () => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
    onClose?.();
  };

  const handleApply = () => {
    if (applied) {
      doClose();
      return;
    }
    if (!plan.updates.length) return;
    if (!armed) {
      setArmed(true);
      return;
    }
    plan.updates.forEach((u) => updateContent(u.fileId, u.content));
    setApplied(true);
    setArmed(false);
    setStatus(
      `Renamed ${plan.totalOccurrences} occurrence${plan.totalOccurrences === 1 ? '' : 's'} in ${plan.filesAffected} file${plan.filesAffected === 1 ? '' : 's'}`
    );
    closeTimer.current = setTimeout(doClose, 900);
  };

  const newTouched = newName.length > 0;
  const showNewError = newTouched && !newValid;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in"
      style={{ backgroundColor: 'rgba(10, 10, 12, 0.72)', backdropFilter: 'blur(6px)' }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) doClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Rename symbol across files"
        className="w-full max-w-md rounded-2xl border border-(--line) bg-(--paper-2) shadow-[0_24px_80px_rgba(0,0,0,0.5)] flex flex-col max-h-[88vh] overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-(--line) shrink-0">
          <div className="flex items-center gap-2.5">
            <span
              className="inline-flex items-center justify-center w-8 h-8 rounded-lg"
              style={{ backgroundColor: 'rgba(88,166,255,0.14)', color: '#58A6FF' }}
            >
              <Replace size={16} />
            </span>
            <div>
              <h2 className="text-lg font-extrabold text-(--ink)">Rename Symbol</h2>
              <p className="text-xs font-mono text-(--muted) mt-0.5">
                Rename an identifier across every file.
              </p>
            </div>
          </div>
          <button
            onClick={doClose}
            aria-label="Close"
            className="p-2 rounded-lg text-(--muted) hover:text-(--ink) hover:bg-(--ink)/6 transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 overflow-y-auto custom-scrollbar">
          <label className="block text-[11px] font-bold tracking-[0.08em] uppercase text-(--muted) mb-1.5">
            Rename
          </label>
          <input
            type="text"
            value={oldName}
            onChange={(e) => {
              setOldName(e.target.value);
              setArmed(false);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleApply();
            }}
            placeholder="Current name"
            autoFocus
            spellCheck={false}
            className="w-full px-3 py-2.5 rounded-lg border border-(--line) bg-(--paper) text-[13px] font-mono text-(--ink) placeholder:text-(--muted) outline-none focus:border-(--blue)/60 transition-colors"
          />
          {!oldValid && (
            <p className="text-[11.5px] font-mono text-(--muted) mt-1.5">
              Enter the current name.
            </p>
          )}

          <label className="block text-[11px] font-bold tracking-[0.08em] uppercase text-(--muted) mt-4 mb-1.5">
            To
          </label>
          <input
            type="text"
            value={newName}
            onChange={(e) => {
              setNewName(e.target.value);
              setArmed(false);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleApply();
            }}
            placeholder="New name"
            spellCheck={false}
            className={`w-full px-3 py-2.5 rounded-lg border bg-(--paper) text-[13px] font-mono text-(--ink) placeholder:text-(--muted) outline-none transition-colors ${
              showNewError ? 'border-[#ef4444]/70 focus:border-[#ef4444]' : 'border-(--line) focus:border-(--blue)/60'
            }`}
          />
          {showNewError && (
            <p className="text-[11.5px] font-mono text-[#ef4444] mt-1.5">
              {newTrimmed === oldTrimmed
                ? 'New name must be different from the current name.'
                : 'Enter a valid identifier (letters, digits, _ and $, not starting with a digit).'}
            </p>
          )}

          {/* Live preview */}
          {oldValid && newValid && (
            <div className="mt-4 rounded-xl border border-(--line) bg-(--paper) overflow-hidden">
              <div className="px-4 py-2.5 border-b border-(--line) text-[12px] font-mono text-(--muted)">
                {plan.totalOccurrences === 0 ? (
                  <span>No matches found.</span>
                ) : (
                  <span>
                    <span className="font-bold text-(--ink)">{plan.totalOccurrences}</span>{' '}
                    occurrence{plan.totalOccurrences === 1 ? '' : 's'} in{' '}
                    <span className="font-bold text-(--ink)">{plan.filesAffected}</span> file
                    {plan.filesAffected === 1 ? '' : 's'}
                  </span>
                )}
              </div>
              {plan.updates.map((u) => (
                <div
                  key={u.fileId}
                  className="flex items-center gap-2 px-4 py-2 border-b border-(--line) last:border-b-0"
                >
                  <FileIcon name={u.fileName} size={12} />
                  <span className="text-[12.5px] font-mono text-(--ink) truncate flex-1">
                    {u.fileName}
                  </span>
                  <span className="text-[11px] font-mono text-(--muted) shrink-0">
                    {u.count}×
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-(--line) shrink-0 flex items-center gap-3">
          {status ? (
            <span className="flex-1 text-[12.5px] font-mono text-emerald-500">{status}</span>
          ) : (
            <span className="flex-1" />
          )}
          <button
            onClick={handleApply}
            disabled={!applied && plan.updates.length === 0}
            className={`px-5 py-2.5 rounded-lg text-[13px] font-bold transition-all whitespace-nowrap cursor-pointer ${
              applied
                ? 'text-(--ink) border border-(--line) hover:bg-(--ink)/5'
                : armed
                  ? 'text-white bg-[#ef4444] hover:brightness-110 active:scale-[0.98]'
                  : 'text-white bg-(--blue) hover:brightness-110 active:scale-[0.98]'
            } disabled:opacity-40 disabled:cursor-not-allowed`}
          >
            {applied ? 'Close' : armed ? 'Click again to rename' : 'Rename'}
          </button>
        </div>
      </div>
    </div>
  );
}

// Host: holds modal state, prefills from the 'synapse:rename-symbol' window event.
export function RenameSymbolHost() {
  const [open, setOpen] = useState(false);
  const [seed, setSeed] = useState('');

  useEffect(() => {
    const handler = (e) => {
      setSeed(e?.detail?.word || '');
      setOpen(true);
    };
    window.addEventListener('synapse:rename-symbol', handler);
    return () => window.removeEventListener('synapse:rename-symbol', handler);
  }, []);

  return <RenameSymbolModal open={open} onClose={() => setOpen(false)} seedWord={seed} />;
}
