import { useEffect, useRef, useState } from 'react';
import Editor from '@monaco-editor/react';
import { MonacoBinding } from 'y-monaco';
import { useFiles } from '../contexts/FileContext';
import { getMonacoLanguage } from '../utils/languageMap';
import { registerSnippetProvider, registerSnippetUseCommand } from '../services/snippetProvider';
import { registerIntellisense } from '../editor/intellisense';
import { registerEmmet } from '../editor/emmet';
import { registerPremiumThemes } from '../editor/themes';
import { setMonacoProblems } from '../diagnostics/problemsStore';
import EditorEmptyState from './EditorEmptyState';
import { fontStackFor } from '../hooks/useEditorSettings';
import { getThemeClasses } from '../utils/theme';
import { Loader2, Users, FileCode2 } from 'lucide-react';

/** Custom Monaco editor color themes (defined once per mount, idempotent). */
function defineCustomEditorThemes(monaco) {
  if (!monaco?.editor?.defineTheme) return;
  const themes = {
    dracula: {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '6272a4' },
        { token: 'string', foreground: 'f1fa8c' },
        { token: 'keyword', foreground: 'ff79c6' },
        { token: 'number', foreground: 'bd93f9' },
        { token: 'type', foreground: '8be9fd' },
        { token: 'delimiter', foreground: 'f8f8f2' },
      ],
      colors: {
        'editor.background': '#282a36',
        'editor.foreground': '#f8f8f2',
        'editor.lineHighlightBackground': '#44475a80',
        'editorLineNumber.foreground': '#6272a4',
        'editorLineNumber.activeForeground': '#f8f8f2',
        'editorCursor.foreground': '#f8f8f2',
        'editor.selectionBackground': '#44475a',
        'editor.inactiveSelectionBackground': '#44475a80',
      },
    },
    monokai: {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '75715e' },
        { token: 'string', foreground: 'e6db74' },
        { token: 'keyword', foreground: 'f92672' },
        { token: 'number', foreground: 'ae81ff' },
        { token: 'type', foreground: '66d9ef' },
        { token: 'delimiter', foreground: 'f8f8f2' },
      ],
      colors: {
        'editor.background': '#272822',
        'editor.foreground': '#f8f8f2',
        'editor.lineHighlightBackground': '#3e3d32',
        'editorLineNumber.foreground': '#90908a',
        'editorLineNumber.activeForeground': '#f8f8f2',
        'editorCursor.foreground': '#f8f8f0',
        'editor.selectionBackground': '#49483e',
        'editor.inactiveSelectionBackground': '#49483e80',
      },
    },
    'night-owl': {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '637777' },
        { token: 'string', foreground: 'ecc48d' },
        { token: 'keyword', foreground: 'c792ea' },
        { token: 'number', foreground: 'f78c6c' },
        { token: 'type', foreground: '7fdbca' },
        { token: 'delimiter', foreground: 'd6deeb' },
      ],
      colors: {
        'editor.background': '#011627',
        'editor.foreground': '#d6deeb',
        'editor.lineHighlightBackground': '#0b2942',
        'editorLineNumber.foreground': '#4b6479',
        'editorLineNumber.activeForeground': '#d6deeb',
        'editorCursor.foreground': '#80a4c2',
        'editor.selectionBackground': '#1d3b53',
        'editor.inactiveSelectionBackground': '#1d3b5380',
      },
    },
    'github-dark': {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '8b949e' },
        { token: 'string', foreground: 'a5d6ff' },
        { token: 'keyword', foreground: 'ff7b72' },
        { token: 'number', foreground: '79c0ff' },
        { token: 'type', foreground: 'ffa657' },
        { token: 'delimiter', foreground: 'e6edf3' },
      ],
      colors: {
        'editor.background': '#0d1117',
        'editor.foreground': '#e6edf3',
        'editor.lineHighlightBackground': '#161b22',
        'editorLineNumber.foreground': '#6e7681',
        'editorLineNumber.activeForeground': '#e6edf3',
        'editorCursor.foreground': '#58a6ff',
        'editor.selectionBackground': '#264f78',
        'editor.inactiveSelectionBackground': '#264f7880',
      },
    },
  };
  for (const [name, def] of Object.entries(themes)) {
    try {
      monaco.editor.defineTheme(name, def);
    } catch {
      /* theme already defined — ignore */
    }
  }
}

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
      border-left: 2px solid ${cursorColor} !important;
      margin-left: -1px;
      pointer-events: none;
      position: relative;
    }
    /* Small colored dot at the top of the cursor line */
    .presence-cursor-${safeId}::before {
      content: "";
      position: absolute;
      top: 0;
      left: -4px;
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: ${cursorColor};
      pointer-events: none;
      z-index: 100;
    }
    /* Selection highlight */
    .presence-selection-${safeId} {
      background: ${hexToRgba(cursorColor, 0.18)} !important;
      border-radius: 2px;
    }
  `;
  document.head.appendChild(style);
}

/** "Who is editing" indicator bar */
function EditingIndicatorBar({ editingUsers = {}, activeFileId, theme }) {
  const editors = Object.values(editingUsers).filter(
    (u) => !activeFileId || u.fileId === activeFileId
  );
  if (editors.length === 0) return null;

  return (
    <div
      className="flex items-center gap-2.5 px-4 py-1.5 border-b border-[#283348] text-xs animate-fade-in shrink-0 overflow-x-auto bg-[#182131] text-[#a8aba3]"
    >
      <span className="flex items-center gap-1.5 shrink-0">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
        <span className="font-mono font-semibold uppercase tracking-[0.14em] text-[10px]">
          Live
        </span>
      </span>
      {editors.map((u) => (
        <span
          key={u.userId}
          className="inline-flex items-center gap-1.5 rounded-md pl-1 pr-2.5 py-0.5 border border-[#283348] bg-white/3 text-[11px] font-medium shrink-0 animate-fade-in"
        >
          <span
            className="w-4 h-4 rounded-full inline-flex items-center justify-center text-[8px] font-bold text-white shrink-0"
            style={{ background: u.cursorColor || '#888' }}
          >
            {(u.username || 'S').charAt(0).toUpperCase()}
          </span>
          <span className="text-[#dce5f3]">
            {u.username || 'Someone'}
          </span>
          <span className="text-[#8290a8]">is editing</span>
        </span>
      ))}
    </div>
  );
}

function FileLockBanner({ activeFileLock, lockedByOther, lockNotice, theme }) {
  // Google Docs mode: no exclusive locks — this is now just a friendly
  // presence hint shown when someone else is also in this file.
  if (!lockedByOther && !lockNotice) return null;

  const message = lockedByOther && activeFileLock
    ? `${activeFileLock.username || 'Another user'} is also editing this file`
    : lockNotice;

  return (
    <div
      className="flex items-center gap-2.5 px-4 py-2 border-b border-[#283348] bg-[#182131] text-xs animate-fade-in shrink-0 text-[#70a5ff]"
    >
      <Users size={12} className="shrink-0" />
      <span className="font-mono font-semibold uppercase tracking-[0.12em] text-[10px]">Live</span>
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
  lockedByOther = false,
  lockNotice = '',
  fileIdOverride = null,
  isPrimary = true,
}) {
  const { activeFile, updateContent, jumpTarget, files } = useFiles();
  const editorRef = useRef(null);
  const monacoRef = useRef(null);
  const decorationsRef = useRef([]);
  const bindingRef = useRef(null);

  // ── Split-editor support (solo page only) ──
  // effectiveFile is the file THIS panel instance renders: normally the
  // global activeFile, or the pinned split file when fileIdOverride is set.
  // fileIdOverride is never passed in rooms, so the room path is untouched.
  const effectiveFile =
    fileIdOverride != null
      ? files.find((f) => f.id === fileIdOverride) || null
      : activeFile;

  // ── Empty-file watermark: show a premium overlay when the file has no content ──
  const [isEmpty, setIsEmpty] = useState(
    () => !(effectiveFile?.content && effectiveFile.content.trim())
  );
  useEffect(() => {
    // Reset on file switch; check initial content (non-Yjs path)
    if (!sharedText) {
      setIsEmpty(!(effectiveFile?.content && effectiveFile.content.trim()));
    }
  }, [effectiveFile?.id, sharedText]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    // Observe Yjs shared text so remote edits also dismiss the watermark
    if (!sharedText) return;
    const update = () => setIsEmpty(sharedText.toString().trim().length === 0);
    update();
    sharedText.observe(update);
    return () => sharedText.unobserve(update);
  }, [sharedText]);

  // Bumped every time onMount fires — this is what lets the binding
  // effect re-run AFTER the editor reference is set.
  const [editorMountKey, setEditorMountKey] = useState(0);

  const activeFileId = activeFileIdProp || effectiveFile?.id;
  const t = getThemeClasses(theme);
  const monacoTheme =
    editorSettings?.editorTheme && editorSettings.editorTheme !== 'auto'
      ? editorSettings.editorTheme
      : theme === 'dark'
        ? 'vs-dark'
        : 'vs';
  const language = effectiveFile ? getMonacoLanguage(effectiveFile.name) : 'plaintext';

  // Re-register snippet provider when the file language changes
  useEffect(() => {
    if (monacoRef.current && language !== 'plaintext') {
      registerSnippetProvider(monacoRef.current, language).catch(() => {});
    }
  }, [language]);

  // Breadcrumbs symbol click → jump the editor to that line.
  // Primary panel only — the split panel has its own pinned file and the
  // Breadcrumbs trail describes the primary file.
  useEffect(() => {
    if (!isPrimary) return;
    const onGotoLine = (e) => {
      const editor = editorRef.current;
      const line = e?.detail?.line;
      if (!editor || !line) return;
      try {
        editor.revealLineInCenter(line);
        editor.setPosition({ lineNumber: line, column: 1 });
        editor.focus();
      } catch {}
    };
    window.addEventListener('synapse:goto-line', onGotoLine);
    return () => window.removeEventListener('synapse:goto-line', onGotoLine);
  }, [isPrimary]);

  // Keep the active file identity fresh for the problems bridge below.
  // Primary panel only — the split panel never feeds the problems store
  // (the primary owns the status bar + problems attribution).
  const activeFileForProblemsRef = useRef(null);
  // Extensions decorations bridge state: last 'synapse:ext-decorations'
  // payload + the live Monaco decorations collection for the current editor.
  const extDecoRef = useRef({ detail: null, collection: null, collectionFor: null, cleanup: null });
  useEffect(() => {
    if (!isPrimary) return;
    activeFileForProblemsRef.current = effectiveFile
      ? { id: effectiveFile.id, name: effectiveFile.name }
      : null;
    if (!effectiveFile) {
      try {
        setMonacoProblems([]);
      } catch {}
    }
  }, [effectiveFile, isPrimary]);

  // Collect current selection for "save as snippet"
  useEffect(() => {
    const onCollect = () => {
      const editor = editorRef.current;
      let code = '';
      try {
        const model = editor?.getModel();
        const sel = editor?.getSelection();
        if (model && sel && !sel.isEmpty()) {
          code = model.getValueInRange(sel);
        }
      } catch {}
      window.dispatchEvent(new CustomEvent('synapse:save-snippet', { detail: { code } }));
    };
    window.addEventListener('synapse:collect-selection', onCollect);
    return () => window.removeEventListener('synapse:collect-selection', onCollect);
  }, []);

  // Insert snippet from SnippetManager (with tab-stop support)
  useEffect(() => {
    const onInsert = (e) => {
      const editor = editorRef.current;
      const code = e.detail?.code;
      if (!editor || !code) return;
      editor.focus();
      try {
        // VS Code's own snippet controller — ${1:...} tab stops work natively
        const ctrl = editor.getContribution('snippetController2');
        if (ctrl && typeof ctrl.insert === 'function') {
          ctrl.insert(code);
          return;
        }
      } catch {}
      // Fallback: plain insert at cursor
      const sel = editor.getSelection();
      const op = { range: sel, text: code, forceMoveMarkers: true };
      editor.executeEdits('synapse-snippet', [op]);
    };
    window.addEventListener('synapse:insert-snippet', onInsert);
    return () => window.removeEventListener('synapse:insert-snippet', onInsert);
  }, []);

  // ─── MonacoBinding ──────────────────────────────────────────────────────────
  //
  // WHY editorMountKey is in the deps:
  //   Monaco's onMount fires asynchronously AFTER the React render cycle.
  //   On first render, editorRef.current is null, so this effect bails out.
  //   When onMount fires it bumps editorMountKey (state), triggering a new
  //   render, which re-runs this effect — now with a valid editorRef.current.
  //
  // WHY activeFileId is in the deps:
  //   <Editor key={effectiveFile.id}> remounts Monaco on file switch, so
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

  // ─── Scroll to line on jumpTarget change (primary panel only) ────────────────
  useEffect(() => {
    if (!isPrimary) return;
    if (!editorRef.current || !jumpTarget || jumpTarget.fileId !== activeFileId) return;

    editorRef.current.revealLineInCenter(jumpTarget.line);
    editorRef.current.setPosition({ lineNumber: jumpTarget.line, column: 1 });
    editorRef.current.focus();
  }, [jumpTarget, activeFileId, editorMountKey, isPrimary]);

  if (!effectiveFile) {
    // Primary keeps the full premium empty state; the split pane renders a
    // slim placeholder until a file is picked from its strip.
    if (isPrimary) return <EditorEmptyState />;
    return (
      <div className={`flex-1 overflow-hidden flex items-center justify-center min-h-0 ${t.editorBg}`}>
        <p className="text-xs font-mono text-[#5a6a85]">Choose a file to open here</p>
      </div>
    );
  }

  return (
    <div className={`flex-1 overflow-hidden flex flex-col min-h-0 ${t.editorBg}`}>
      {/* Real-time "who is editing" indicator */}
      <EditingIndicatorBar editingUsers={editingUsers} activeFileId={activeFileId} theme={theme} />
      <FileLockBanner activeFileLock={activeFileLock} lockedByOther={lockedByOther} lockNotice={lockNotice} theme={theme} />

      <div style={{ flex: 1, overflow: 'hidden' }} className="min-h-0 relative">
        {/* ── Empty-file watermark ── */}
        {isEmpty && (
          <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none animate-fade-in">
            <div className="flex flex-col items-center gap-4 text-center px-6 max-w-sm">
              <span className="w-14 h-14 rounded-2xl bg-[#ff4d35] flex items-center justify-center shadow-[6px_6px_0_rgba(0,0,0,0.4)]">
                <FileCode2 size={24} className="text-white" />
              </span>
              <div>
                <p className="text-lg font-extrabold tracking-tight text-[#dce5f3]">
                  Start typing
                </p>
                <p className="text-xs text-[#8290a8] font-mono mt-1.5 leading-5">
                  Your code appears here.<br />Collaborators see every keystroke live.
                </p>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <span className="rounded-md border border-[#283348] bg-[#182131] px-2 py-1 font-mono text-[10px] text-[#8290a8]">Ctrl K</span>
                <span className="text-[10px] text-[#5a6a85] font-mono">command palette</span>
                <span className="text-[#283348]">·</span>
                <span className="rounded-md border border-[#283348] bg-[#182131] px-2 py-1 font-mono text-[10px] text-[#8290a8]">Ctrl ⏎</span>
                <span className="text-[10px] text-[#5a6a85] font-mono">run code</span>
              </div>
            </div>
          </div>
        )}
        <Editor
          key={effectiveFile.id}
          height="100%"
          language={language}
          theme={monacoTheme}
          defaultValue={sharedText ? '' : effectiveFile.content}
          onChange={(value) => {
            setIsEmpty(!(value && value.trim()));
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

            // Register custom color themes (Dracula, Monokai, Night Owl, GitHub Dark)
            defineCustomEditorThemes(monaco);
            try {
              registerPremiumThemes(monaco);
            } catch {}

            // ─── Snippet Tab-completion (VS Code style) ───
            try {
              const mLang = getMonacoLanguage(effectiveFile?.name || '');
              registerSnippetProvider(monaco, mLang);
              registerSnippetUseCommand(editor);
            } catch {}

            // ─── VS Code Wave 1: IntelliSense (React/Tailwind/JSON) + Emmet ───
            try {
              registerIntellisense(monaco);
            } catch {}
            try {
              registerEmmet(editor, monaco);
            } catch {}

            // ─── Problems bridge: Monaco markers → problems store (primary only) ───
            if (isPrimary) {
            try {
              const modelUri = editor.getModel()?.uri?.toString();
              const pushMarkers = () => {
                try {
                  const info = activeFileForProblemsRef.current;
                  const markers = monaco.editor
                    .getModelMarkers({})
                    .filter((mk) => !modelUri || mk.resource?.toString() === modelUri);
                  setMonacoProblems(
                    markers.map((mk) => ({
                      fileId: info?.id || null,
                      fileName: info?.name || 'Current file',
                      path: null,
                      line: mk.startLineNumber,
                      column: mk.startColumn,
                      severity:
                        mk.severity === monaco.MarkerSeverity.Error
                          ? 'error'
                          : mk.severity === monaco.MarkerSeverity.Warning
                            ? 'warning'
                            : 'info',
                      message: mk.message,
                      source: 'monaco',
                    }))
                  );
                } catch {}
              };
              monaco.editor.onDidChangeMarkers(() => pushMarkers());
              pushMarkers();
            } catch {}
            }

            // ─── Extensions decorations bridge: extension line highlights ───
            // (e.g. TODO highlighter) applied to this editor's file only.
            // The last payload is kept in a ref and re-applied on every
            // editor mount, so highlights survive file switches.
            if (isPrimary) {
            try {
              extDecoRef.current.cleanup?.();
              const applyExt = () => {
                try {
                  const ed = editorRef.current;
                  if (!ed) return;
                  if (extDecoRef.current.collectionFor !== ed) {
                    extDecoRef.current.collection = ed.createDecorationsCollection([]);
                    extDecoRef.current.collectionFor = ed;
                  }
                  const fid = effectiveFile?.id;
                  const list = (extDecoRef.current.detail?.items || []).filter(
                    (it) => !fid || it.fileId === fid
                  );
                  extDecoRef.current.collection.set(
                    list.map((it) => ({
                      range: new monaco.Range(it.line, 1, it.line, 1),
                      options: {
                        isWholeLine: true,
                        className: it.kind === 'fixme' ? 'synapse-fixme-line' : 'synapse-todo-line',
                      },
                    }))
                  );
                } catch {}
              };
              const onExt = (e) => {
                extDecoRef.current.detail = e.detail || null;
                applyExt();
              };
              window.addEventListener('synapse:ext-decorations', onExt);
              extDecoRef.current.cleanup = () =>
                window.removeEventListener('synapse:ext-decorations', onExt);
              applyExt();
            } catch {}
            }

            // The binding is created ONLY by the binding useEffect below (it
            // re-runs on the editorMountKey bump). Creating one here as well
            // would risk two live MonacoBindings on the same Y.Text + model —
            // each binding has its own mutex, so a double-bound pair
            // echo-duplicates every keystroke (Enter included).
            // Bump the mount key so the binding useEffect re-evaluates with
            // the now-valid editorRef.current (handles the case where sharedText
            // arrives AFTER the editor mounts).
            setEditorMountKey((k) => k + 1);

            editor.onDidChangeCursorSelection((event) => {
              onCursorMove?.(event.selection.getPosition());
              // Bridge for StatusBar + Breadcrumbs (VS Code chrome).
              // Primary panel only — the split panel must not hijack the
              // status bar or the symbol tracking.
              if (isPrimary) {
              try {
                const sel = event.selection;
                let selectedChars = 0;
                try {
                  const m = editor.getModel();
                  if (m && !sel.isEmpty()) selectedChars = m.getValueInRange(sel).length;
                } catch {}
                window.dispatchEvent(
                  new CustomEvent('synapse:cursor', {
                    detail: {
                      line: sel.positionLineNumber,
                      column: sel.positionColumn,
                      selectedChars,
                    },
                  })
                );
              } catch {}
              }
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
              <Loader2 size={18} className="animate-spin" />
              <span className="text-sm">Loading editor</span>
            </div>
          }
          options={{
            readOnly: isReadOnly,
            domReadOnly: isReadOnly,
            fontSize: editorSettings?.fontSize ?? 15,
            fontFamily: fontStackFor(editorSettings?.fontFamily),
            fontLigatures: true,
            lineHeight: editorSettings?.lineHeight ?? 1.6,
            minimap: { enabled: editorSettings?.minimap ?? true, scale: 1, renderCharacters: false, maxColumn: 90 },
            scrollBeyondLastLine: false,
            smoothScrolling: true,
            cursorBlinking: 'smooth',
            cursorSmoothCaretAnimation: 'on',
            cursorStyle: editorSettings?.cursorStyle ?? 'line',
            renderLineHighlight: 'all',
            renderWhitespace: editorSettings?.renderWhitespace ?? 'selection',
            bracketPairColorization: { enabled: editorSettings?.bracketColorization ?? true },
            guides: { bracketPairs: true, indentation: true, highlightActiveIndentation: true },
            stickyScroll: { enabled: editorSettings?.stickyScroll ?? true },
            formatOnPaste: true,
            formatOnType: editorSettings?.formatOnType ?? false,
            wordWrap: editorSettings?.wordWrap ?? 'off',
            padding: { top: 12, bottom: 24 },
            lineNumbers: 'on',
            glyphMargin: false,
            folding: true,
            codeLens: false,
            links: true,
            'semanticHighlighting.enabled': true,
            occurrencesHighlight: 'singleFile',
            selectionHighlight: true,
            hover: { enabled: true, delay: 300 },
            automaticLayout: true,
            tabSize: editorSettings?.tabSize ?? 4,
            insertSpaces: true,
            scrollbar: { verticalScrollbarSize: 10, horizontalScrollbarSize: 10, useShadows: false },
            suggest: { showIcons: true, showStatusBar: true, preview: true },
          }}
        />
      </div>
    </div>
  );
}
