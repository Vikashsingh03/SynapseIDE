import { useEffect, useRef, useState } from 'react';
import { X, Keyboard, RotateCcw } from 'lucide-react';
import { getThemeClasses } from '../utils/theme';
import {
  COMMANDS,
  loadBindings,
  saveBinding,
  resetBinding,
  resetBindings,
  effectiveBindings,
  chordFromEvent,
  eventMatchesChord,
  normalizeChord,
  findConflict,
  findFixedShortcut,
} from '../utils/keybindings';

function isEditableTarget(target) {
  if (!target || typeof target !== 'object') return false;
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (target.isContentEditable) return true;
  return false;
}

export default function KeybindingsModal({ open, onClose, theme = 'dark' }) {
  const t = getThemeClasses(theme);
  const [overrides, setOverrides] = useState({});
  const [recordingId, setRecordingId] = useState(null);
  const [warning, setWarning] = useState('');

  useEffect(() => {
    if (!open) return;
    setOverrides(loadBindings());
    setRecordingId(null);
    setWarning('');
  }, [open ]);

  useEffect(() => {
    if (!recordingId) return;
    const onKey = (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.key === 'Escape') {
        setRecordingId(null);
        return;
      }
      const chord = chordFromEvent(e);
      if (!chord) return;
      const fixed = findFixedShortcut(chord);
      if (fixed) {
        setWarning(`${chord} — yeh shortcut pehle se istemal ho raha hai (${fixed.label}). Koi aur shortcut chunein.`);
        setRecordingId(null);
        return;
      }
      const conflictId = findConflict(effectiveBindings(overrides), chord, recordingId);
      if (conflictId) {
        const other = COMMANDS.find((c) => c.id === conflictId);
        setWarning(`${chord} — yeh shortcut pehle se istemal ho raha hai (${other ? other.label : conflictId}). Pehle usey badlein ya reset karein.`);
        setRecordingId(null);
        return;
      }
      setOverrides(saveBinding(recordingId, chord));
      setWarning('');
      setRecordingId(null);
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [recordingId, overrides]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape' && !recordingId) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, recordingId, onClose]);

  if (!open) return null;

  const effective = effectiveBindings(overrides);

  return (
    <div className={t.modalOverlay} onClick={onClose}>
      <div
        className={`${t.modalCard} w-[min(640px,94vw)] max-h-[84vh] flex flex-col`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={`flex items-center gap-3 px-5 py-4 border-b ${t.border} shrink-0`}>
          <span className="flex items-center justify-center w-9 h-9 rounded-md border bg-(--blue)/10 border-(--blue)/30">
            <Keyboard size={17} className="text-(--blue)" />
          </span>
          <div className="flex-1 min-w-0">
            <h2 className={`text-sm font-extrabold ${t.textPrimary}`}>Keyboard Shortcuts</h2>
            <p className={`text-xs ${t.textMuted} truncate`}>
              Apne shortcuts khud tay karein — changes turant save ho jate hain.
            </p>
          </div>
          <button onClick={onClose} className={t.iconBtn} title="Close">
            <X size={15} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-3">
          {warning && (
            <div className="mb-3 px-3 py-2 rounded-md border border-amber-500/30 bg-amber-500/10 text-amber-600 text-xs font-medium">
              {warning}
            </div>
          )}
          <div className="flex flex-col divide-y divide-(--line)">
            {COMMANDS.map((cmd) => {
              const isCustom = Boolean(overrides[cmd.id]);
              const isRecording = recordingId === cmd.id;
              return (
                <div key={cmd.id} className="flex items-center gap-3 py-3">
                  <div className="flex-1 min-w-0">
                    <p className={`text-[13px] font-semibold ${t.textPrimary} truncate`}>{cmd.label}</p>
                    <p className={`text-[11px] ${t.textMuted}`}>
                      Default: {cmd.defaultChord}
                      {isCustom ? ' · custom' : ''}
                    </p>
                  </div>
                  <span className={t.kbd}>{effective[cmd.id]}</span>
                  <button
                    onClick={() => {
                      setWarning('');
                      setRecordingId(isRecording ? null : cmd.id);
                    }}
                    className={`${t.btnSecondary} text-xs! px-2.5! py-1.5! ${isRecording ? 'border-(--blue)/40! text-(--blue)!' : ''}`}
                  >
                    {isRecording ? 'Press keys… (Esc to cancel)' : 'Record'}
                  </button>
                  <button
                    onClick={() => {
                      setOverrides(resetBinding(cmd.id));
                      setWarning('');
                      if (isRecording) setRecordingId(null);
                    }}
                    disabled={!isCustom}
                    className={`${t.iconBtn} disabled:opacity-40`}
                    title="Reset to default"
                  >
                    <RotateCcw size={13} />
                  </button>
                </div>
              );
            })}
          </div>
          <p className={`text-[11px] ${t.textMuted} mt-3`}>
            Fixed shortcuts — Ctrl+K (Command Palette), Ctrl+S (Save File) aur Ctrl+Shift+T (Reopen Closed
            Tab) — kisi aur command ko nahi diye ja sakte.
          </p>
        </div>

        <div className={`flex items-center justify-between px-5 py-3.5 border-t ${t.border} shrink-0`}>
          <p className={`text-[11px] ${t.textMuted}`}>Changes save automatically — koi alag Save button nahi hai.</p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setOverrides(resetBindings());
                setWarning('');
                setRecordingId(null);
              }}
              className={t.btnSecondary}
            >
              <RotateCcw size={14} /> Reset All
            </button>
            <button onClick={onClose} className={t.btnPrimary}>
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function KeybindingsHost({ theme = 'dark' }) {
  const [open, setOpen] = useState(false);
  const openRef = useRef(false);

  useEffect(() => {
    openRef.current = open;
  }, [open ]);

  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener('synapse:open-keybindings', onOpen);

    const onKey = (e) => {
      if (openRef.current) return;
      if (e.repeat) return;
      if (isEditableTarget(e.target)) return;
      const overrides = loadBindings();
      const effective = effectiveBindings(overrides);
      for (const cmd of COMMANDS) {
        if (cmd.id === 'quickOpen') {
          const override = overrides.quickOpen;
          if (!override) continue;
          if (normalizeChord(override) === cmd.defaultChord) continue;
        }
        if (eventMatchesChord(e, effective[cmd.id])) {
          e.preventDefault();
          window.dispatchEvent(new CustomEvent(cmd.event));
          return;
        }
      }
    };
    window.addEventListener('keydown', onKey);

    return () => {
      window.removeEventListener('synapse:open-keybindings', onOpen);
      window.removeEventListener('keydown', onKey);
    };
  }, []);

  if (!open) return null;
  return <KeybindingsModal open={open} onClose={() => setOpen(false)} theme={theme} />;
}
