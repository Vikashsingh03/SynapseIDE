import { useEffect, useRef, useState } from 'react';
import Editor from '@monaco-editor/react';
import { MonacoBinding } from 'y-monaco';
import { useFiles } from '../contexts/FileContext';
import { getMonacoLanguage } from '../utils/languageMap';
import { getThemeClasses } from '../utils/theme';
import { Loader2, Lock, FileCode2 } from 'lucide-react';



function hexToRgba(color, alpha) {
  const normalized = color.replace('#', '');
  const expanded =
    normalized.length === 3
      ? normalized
          .split('')
          .map((char) => `${char}${char}`)
          .join('')
      : normalized;
  const red = parseInt(expanded.slice(0, 2), 16);
  const green = parseInt(expanded.slice(2, 4), 16);
  const blue = parseInt(expanded.slice(4, 6), 16);

  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function ensurePresenceStyle(userId, cursorColor) {
  if (typeof document === 'undefined') return;

  const safeId = String(userId).replace(/[^a-zA-Z0-9_-]/g, '-');
  const styleId = `presence-style-${safeId}`;
  // Always recreate if color changed (remove old style)
  const existing = document.getElementById(styleId);
  if (existing) return;

  const style = document.createElement('style');
  style.id = styleId;
  style.textContent = `
    /* Colored cursor line — full height of the line */
    .presence-cursor-${safeId} {
      border-left: 3px solid ${cursorColor} !important;
      margin-left: -2px;
      box-shadow: 0 0 6px 1px ${hexToRgba(cursorColor, 0.55)};
      pointer-events: none;
      position: relative;
    }
    /* Small colored dot at the top of the cursor line */
    .presence-cursor-${safeId}::before {
      content: "";
      position: absolute;
      top: 0;
      left: -5px;
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: ${cursorColor};
      box-shadow: 0 0 5px 1px ${hexToRgba(cursorColor, 0.7)};
      pointer-events: none;
      z-index: 100;
    }
    /* Selection highlight */
    .presence-selection-${safeId} {
      background: ${hexToRgba(cursorColor, 0.2)} !important;
      border-radius: 2px;
    }
  `;
  document.head.appendChild(style);
}

/** Animated "who is typing" bar */
function EditingIndicatorBar({ editingUsers = {}, activeFileId, theme }) {
  const editors = Object.values(editingUsers).filter(
    (u) => !activeFileId || u.fileId === activeFileId
  );
  if (editors.length === 0) return null;

  return (
    <div
      className={`flex items-center gap-2 px-4 py-1.5 border-b text-xs animate-fade-in shrink-0 overflow-x-auto scrollbar-hide ${
        theme === 'dark'
          ? 'bg-violet-500/6 border-violet-500/20 text-slate-300'
          : 'bg-violet-50 border-violet-200 text-slate-600'
      }`}
    >
      <span className="flex items-center gap-1.5 shrink-0">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-60" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-violet-400" />
        </span>
        <span className={`font-bold uppercase tracking-[0.14em] text-[10px] ${theme === 'dark' ? 'text-violet-300' : 'text-violet-600'}`}>
          Live
        </span>
      </span>
      {editors.map((u) => (
        <span
          key={u.userId}
          className="inline-flex items-center gap-1.5 rounded-full pl-1 pr-2.5 py-0.5 border text-[11px] font-medium shrink-0 animate-scale-in"
          style={{
            background: hexToRgba(u.cursorColor || '#888', 0.1),
            borderColor: hexToRgba(u.cursorColor || '#888', 0.35),
          }}
        >
          <span
            className="w-4 h-4 rounded-full inline-flex items-center justify-center text-[8px] font-bold text-white shrink-0"
            style={{ background: u.cursorColor || '#888' }}
          >
            {(u.username || 'S').charAt(0).toUpperCase()}
          </span>
          <span style={{ color: u.cursorColor || '#ccc' }} className="font-semibold">
            {u.username || 'Someone'}
          </span>
          <span className="opacity-60">is editing</span>
        </span>
      ))}
    </div>
  );
}

function FileLockBanner({ activeFileLock, isReadOnly, lockNotice, theme }) {
  if (!activeFileLock && !lockNotice) return null;

  const message = isReadOnly && activeFileLock
    ? `${activeFileLock.username || 'Another user'} is editing this file. View-only mode is active.`
    : activeFileLock
      ? 'You hold the edit lock for this file.'
      : lockNotice;

  return (
    <div
      className={`flex items-center gap-2.5 px-4 py-2 border-b text-xs animate-fade-in shrink-0 ${
        isReadOnly
          ? theme === 'dark'
            ? 'bg-amber-500/8 border-amber-500/25 text-amber-200'
            : 'bg-amber-50 border-amber-200 text-amber-700'
          : theme === 'dark'
            ? 'bg-indigo-500/8 border-indigo-500/25 text-indigo-200'
            : 'bg-indigo-50 border-indigo-200 text-indigo-700'
      }`}
    >
      <span className={`p-1 rounded-md ${isReadOnly ? 'bg-amber-500/15' : 'bg-indigo-500/15'}`}>
        <Lock size={12} />
      </span>
      <span className="font-bold uppercase tracking-[0.12em] text-[10px]">{isReadOnly ? 'Locked' : 'Lock'}</span>
      <span className="opacity-90">{message}</span>
    </div>
  );
}

export default function EditorPanel({
  theme,
  editorSettings,
  onCursorMove,
  onSelectionChange,
  onLocalChange,
  sharedText,
  remotePeers = [],
  editingUsers = {},
  activeFileId: activeFileIdProp,
  activeFileLock = null,
  isReadOnly = false,
  lockNotice = '',
}) {
  const { activeFile, updateContent, jumpTarget } = useFiles();
  const editorRef = useRef(null);
  const monacoRef = useRef(null);
  const decorationsRef = useRef([]);
  const bindingRef = useRef(null);
  const sharedTextRef = useRef(null);

  // Bumped every time onMount fires — this is what lets the binding
  // effect re-run AFTER the editor reference is set.
  const [editorMountKey, setEditorMountKey] = useState(0);

  const activeFileId = activeFileIdProp || activeFile?.id;
  const t = getThemeClasses(theme);
  const monacoTheme = theme === 'dark' ? 'vs-dark' : 'vs';
  const language = activeFile ? getMonacoLanguage(activeFile.name) : 'plaintext';

  // Keep sharedTextRef current so onMount can access the latest Y.Text
  // without a stale-closure issue.
  useEffect(() => {
    sharedTextRef.current = sharedText;
  }, [sharedText]);

  // ─── MonacoBinding ──────────────────────────────────────────────────────────
  //
  // WHY editorMountKey is in the deps:
  //   Monaco's onMount fires asynchronously AFTER the React render cycle.
  //   On first render, editorRef.current is null, so this effect bails out.
  //   When onMount fires it bumps editorMountKey (state), triggering a new
  //   render, which re-runs this effect — now with a valid editorRef.current.
  //
  // WHY activeFileId is in the deps:
  //   <Editor key={activeFile.id}> remounts Monaco on file switch, so
  //   editorMountKey increments again via onMount, and we recreate the binding
  //   for the new file's Y.Text.
  useEffect(() => {
    const editor = editorRef.current;
    if (!sharedText || !editor) return undefined;

    const model = editor.getModel();
    if (!model) return undefined;

    // Destroy any existing binding before creating a new one
    if (bindingRef.current) {
      bindingRef.current.destroy();
      bindingRef.current = null;
    }

    const binding = new MonacoBinding(sharedText, model, new Set([editor]));
    bindingRef.current = binding;

    return () => {
      binding.destroy();
      bindingRef.current = null;
    };
  }, [sharedText, editorMountKey, activeFileId]);

  // ─── Remote cursor & selection decorations ──────────────────────────────────
  useEffect(() => {
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    if (!editor || !monaco || !activeFileId) return undefined;

    const nextDecorations = remotePeers.flatMap((peer) => {
      if (!peer?.userId || !peer?.cursorColor) return [];

      ensurePresenceStyle(peer.userId, peer.cursorColor);
      const safeId = String(peer.userId).replace(/[^a-zA-Z0-9_-]/g, '-');
      const decorations = [];

      if (
        peer.selectionRange?.startLineNumber &&
        peer.selectionRange?.startColumn &&
        peer.selectionRange?.endLineNumber &&
        peer.selectionRange?.endColumn
      ) {
        decorations.push({
          range: new monaco.Range(
            peer.selectionRange.startLineNumber,
            peer.selectionRange.startColumn,
            peer.selectionRange.endLineNumber,
            peer.selectionRange.endColumn
          ),
          options: { className: `presence-selection-${safeId}` },
        });
      }

      if (peer.position?.lineNumber && peer.position?.column) {
        decorations.push({
          range: new monaco.Range(
            peer.position.lineNumber,
            peer.position.column,
            peer.position.lineNumber,
            peer.position.column + 1
          ),
          options: {
            className: `presence-cursor-${safeId}`,
            hoverMessage: { value: `${peer.username || 'Anonymous'} is editing here` },
          },
        });
      }

      return decorations;
    });

    decorationsRef.current = editor.deltaDecorations(decorationsRef.current, nextDecorations);

    return () => {
      if (editorRef.current) {
        decorationsRef.current = editorRef.current.deltaDecorations(
          decorationsRef.current,
          []
        );
      }
    };
  }, [remotePeers, activeFileId]);

  // ─── Scroll to line on jumpTarget change ────────────────────────────────────
  useEffect(() => {
    if (!editorRef.current || !jumpTarget || jumpTarget.fileId !== activeFileId) return;

    editorRef.current.revealLineInCenter(jumpTarget.line);
    editorRef.current.setPosition({ lineNumber: jumpTarget.line, column: 1 });
    editorRef.current.focus();
  }, [jumpTarget, activeFileId, editorMountKey]);

  if (!activeFile) {
    return (
      <div className={`flex-1 flex items-center justify-center ${t.editorBg}`}>
        <div className="text-center animate-fade-up px-6">
          <div className={`mx-auto mb-4 w-14 h-14 rounded-2xl flex items-center justify-center ${theme === 'dark' ? 'bg-violet-500/10 border border-violet-500/20' : 'bg-violet-50 border border-violet-200'}`}>
            <FileCode2 size={24} className="text-violet-400" />
          </div>
          <p className={`text-base font-semibold font-display ${t.textPrimary}`}>No file open</p>
          <p className={`text-sm mt-1 ${t.textMuted}`}>Create a new file or open one from the sidebar</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex-1 overflow-hidden flex flex-col min-h-0 ${t.editorBg}`}>
      {/* Real-time "who is editing" indicator */}
      <EditingIndicatorBar editingUsers={editingUsers} activeFileId={activeFileId} theme={theme} />
      <FileLockBanner activeFileLock={activeFileLock} isReadOnly={isReadOnly} lockNotice={lockNotice} theme={theme} />

      <div style={{ flex: 1, overflow: 'hidden' }} className="min-h-0">
        <Editor
          key={activeFile.id}
          height="100%"
          language={language}
          theme={monacoTheme}
          defaultValue={sharedText ? '' : activeFile.content}
          onChange={(value) => {
            if (!sharedText && activeFileId && updateContent) {
              updateContent(activeFileId, value || '', { updatedAt: Date.now() });
            }
            if (onLocalChange && activeFileId) {
              onLocalChange(activeFileId, value || '');
            }
          }}
          onMount={(editor, monaco) => {
            editorRef.current = editor;
            monacoRef.current = monaco;

            // If sharedText already arrived before the editor mounted, create
            // the binding immediately here so we don't wait for a re-render.
            // The binding useEffect will see bindingRef.current set and skip.
            const currentSharedText = sharedTextRef.current;
            if (currentSharedText) {
              const model = editor.getModel();
              if (model) {
                if (bindingRef.current) {
                  bindingRef.current.destroy();
                }
                bindingRef.current = new MonacoBinding(
                  currentSharedText,
                  model,
                  new Set([editor])
                );
              }
            }

            // Bump the mount key so the binding useEffect re-evaluates with
            // the now-valid editorRef.current (handles the case where sharedText
            // arrives AFTER the editor mounts).
            setEditorMountKey((k) => k + 1);

            editor.onDidChangeCursorSelection((event) => {
              onCursorMove?.(event.selection.getPosition());
              onSelectionChange?.({
                startLineNumber: event.selection.startLineNumber,
                startColumn: event.selection.startColumn,
                endLineNumber: event.selection.endLineNumber,
                endColumn: event.selection.endColumn,
              });
            });
          }}
          loading={
            <div className={`flex items-center justify-center h-full gap-2.5 ${t.textMuted}`}>
              <Loader2 size={20} className="animate-spin text-violet-400" />
              <span className="text-sm">Loading editor…</span>
            </div>
          }
          options={{
            readOnly: isReadOnly,
            domReadOnly: isReadOnly,
            fontSize: editorSettings?.fontSize ?? 15,
            fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
            fontLigatures: true,
            minimap: { enabled: editorSettings?.minimap ?? true, scale: 1 },
            scrollBeyondLastLine: false,
            smoothScrolling: true,
            cursorBlinking: 'smooth',
            cursorSmoothCaretAnimation: 'on',
            renderLineHighlight: 'all',
            bracketPairColorization: { enabled: true },
            formatOnPaste: true,
            wordWrap: editorSettings?.wordWrap ?? 'off',
            padding: { top: 24, bottom: 24 },
            lineNumbers: 'on',
            glyphMargin: false,
            folding: true,
            automaticLayout: true,
            tabSize: 4,
            insertSpaces: true,
            suggest: { showIcons: true, showStatusBar: true },
          }}
        />
      </div>
    </div>
  );
}
