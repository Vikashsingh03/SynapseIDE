import { useEffect, useRef, useState } from 'react';
import Editor from '@monaco-editor/react';
import { MonacoBinding } from 'y-monaco';
import { useFiles } from '../contexts/FileContext';
import { getMonacoLanguage } from '../utils/languageMap';
import { buildExplainSelectionPrompt } from '../utils/selectionActions';
import { registerSnippetProvider, registerSnippetUseCommand } from '../services/snippetProvider';
import { registerIntellisense, syncProjectFiles } from '../editor/intellisense';
import { registerGhostText } from '../editor/ghostText';
import { registerEmmet } from '../editor/emmet';
import { registerPremiumThemes } from '../editor/themes';
import { setMonacoProblems } from '../diagnostics/problemsStore';
import { registerPrettierFormattingProvider, formatWithPrettier } from '../editor/prettierFormat';
import {
  getBreakpoints,
  toggleBreakpoint,
  subscribe as subscribeBreakpoints,
  relPathOf,
} from '../debug/breakpointsStore';
import EditorEmptyState from './EditorEmptyState';
import { fontStackFor } from '../hooks/useEditorSettings';
import { getThemeClasses } from '../utils/theme';
import { Loader2, Users, FileCode2 } from 'lucide-react';

 
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
  forceReadOnly = false,
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
  
  
  const filesRef = useRef([]);
  useEffect(() => {
    filesRef.current = files;
  }, [files]);

  
  
  
  
  const effectiveFile =
    fileIdOverride != null
      ? files.find((f) => f.id === fileIdOverride) || null
      : activeFile;

  
  const [isEmpty, setIsEmpty] = useState(
    () => !(effectiveFile?.content && effectiveFile.content.trim())
  );
  useEffect(() => {
    
    if (!sharedText) {
      setIsEmpty(!(effectiveFile?.content && effectiveFile.content.trim()));
    }
  }, [effectiveFile?.id, sharedText]); 
  useEffect(() => {
    
    if (!sharedText) return;
    const update = () => setIsEmpty(sharedText.toString().trim().length === 0);
    update();
    sharedText.observe(update);
    return () => sharedText.unobserve(update);
  }, [sharedText]);

  
  
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

  
  useEffect(() => {
    if (monacoRef.current && language !== 'plaintext') {
      registerSnippetProvider(monacoRef.current, language).catch(() => {});
    }
  }, [language]);

  
  
  
  
  useEffect(() => {
    if (monacoRef.current) {
      try {
        syncProjectFiles(monacoRef.current, files);
      } catch {}
    }
  }, [files]);

  
  
  
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

  
  
  
  const activeFileForProblemsRef = useRef(null);
  
  
  const extDecoRef = useRef({ detail: null, collection: null, collectionFor: null, cleanup: null });
  
  
  const bpDecoRef = useRef({ collection: null, collectionFor: null, unsubscribe: null });
  const lineDecoRef = useRef({ collection: null, collectionFor: null });
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

  
  
  
  useEffect(() => {
    if (!isPrimary) return undefined;
    const onNeuraApply = (e) => {
      try {
        const { fileId, mode, afterLine, content } = e.detail || {};
        const editor = editorRef.current;
        if (!editor || !fileId || fileId !== activeFileForProblemsRef.current?.id) return;
        const model = editor.getModel();
        if (!model || typeof content !== 'string') return;
        if (mode === 'replace') {
          editor.executeEdits('neura-apply', [
            { range: model.getFullModelRange(), text: content, forceMoveMarkers: true },
          ]);
        } else if (mode === 'insert') {
          const lineCount = model.getLineCount();
          const at = Math.min(Math.max(Number(afterLine) || 0, 0), lineCount);
          if (at === 0) {
            const text = content.endsWith('\n') ? content : content + '\n';
            editor.executeEdits('neura-apply', [
              {
                range: { startLineNumber: 1, startColumn: 1, endLineNumber: 1, endColumn: 1 },
                text,
                forceMoveMarkers: true,
              },
            ]);
          } else {
            const col = model.getLineMaxColumn(at);
            editor.executeEdits('neura-apply', [
              {
                range: { startLineNumber: at, startColumn: col, endLineNumber: at, endColumn: col },
                text: '\n' + content,
                forceMoveMarkers: true,
              },
            ]);
          }
        }
        editor.focus();
      } catch {}
    };
    window.addEventListener('synapse:neura-apply', onNeuraApply);
    return () => window.removeEventListener('synapse:neura-apply', onNeuraApply);
  }, [isPrimary]);

  
  
  
  
  
  
  useEffect(() => {
    if (!isPrimary) return undefined;
    const onFormat = async () => {
      try {
        const editor = editorRef.current;
        if (!editor) return;
        const model = editor.getModel();
        if (!model) return;
        const info = activeFileForProblemsRef.current; 
        const fileName = (info && info.name) || '';
        const current = model.getValue();
        let result = null;
        try {
          result = await formatWithPrettier(current, fileName, filesRef.current);
        } catch {
          result = null;
        }
        if (result && result !== current) {
          editor.pushUndoStop();
          editor.executeEdits('prettier-format', [
            { range: model.getFullModelRange(), text: result, forceMoveMarkers: true },
          ]);
          editor.pushUndoStop();
          editor.focus();
        } else if (result === null) {
          editor.getAction('editor.action.formatDocument')?.run();
        }
      } catch {}
    };
    window.addEventListener('synapse:format-document', onFormat);
    return () => window.removeEventListener('synapse:format-document', onFormat);
  }, [isPrimary]);

  
  
  
  useEffect(() => {
    if (!isPrimary) return;
    const applyLine = (rel, line) => {
      try {
        const ed = editorRef.current;
        if (!ed || !window.monaco) return;
        if (lineDecoRef.current.collectionFor !== ed) {
          lineDecoRef.current.collection = ed.createDecorationsCollection([]);
          lineDecoRef.current.collectionFor = ed;
        }
        const match = line && relPathOf(effectiveFile, files) === rel;
        lineDecoRef.current.collection.set(
          match
            ? [
                {
                  range: new window.monaco.Range(line, 1, line, 1),
                  options: {
                    isWholeLine: true,
                    className: 'synapse-debug-line',
                    glyphMarginClassName: 'synapse-debug-line-glyph',
                  },
                },
              ]
            : []
        );
        if (match) ed.revealLineInCenter(line);
      } catch {}
    };
    const onLine = (e) => applyLine(e.detail?.relPath, e.detail?.line ?? null);
    window.addEventListener('synapse:debug-line', onLine);
    
    try {
      lineDecoRef.current.collection?.set([]);
    } catch {}
    return () => window.removeEventListener('synapse:debug-line', onLine);
  }, [isPrimary, effectiveFile]);

  
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

  
  useEffect(() => {
    const onInsert = (e) => {
      const editor = editorRef.current;
      const code = e.detail?.code;
      if (!editor || !code) return;
      editor.focus();
      try {
        
        const ctrl = editor.getContribution('snippetController2');
        if (ctrl && typeof ctrl.insert === 'function') {
          ctrl.insert(code);
          return;
        }
      } catch {}
      
      const sel = editor.getSelection();
      const op = { range: sel, text: code, forceMoveMarkers: true };
      editor.executeEdits('synapse-snippet', [op]);
    };
    window.addEventListener('synapse:insert-snippet', onInsert);
    return () => window.removeEventListener('synapse:insert-snippet', onInsert);
  }, []);

  
  
  
  
  
  
  
  
  
  
  
  
  useEffect(() => {
    const editor = editorRef.current;
    if (!sharedText || !editor) return undefined;

    const model = editor.getModel();
    if (!model) return undefined;

    
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

  
  useEffect(() => {
    if (!isPrimary) return;
    if (!editorRef.current || !jumpTarget || jumpTarget.fileId !== activeFileId) return;

    editorRef.current.revealLineInCenter(jumpTarget.line);
    editorRef.current.setPosition({ lineNumber: jumpTarget.line, column: 1 });
    editorRef.current.focus();
  }, [jumpTarget, activeFileId, editorMountKey, isPrimary]);

  if (!effectiveFile) {
    
    
    if (isPrimary) return <EditorEmptyState />;
    return (
      <div className={`flex-1 overflow-hidden flex items-center justify-center min-h-0 ${t.editorBg}`}>
        <p className="text-xs font-mono text-[#5a6a85]">Choose a file to open here</p>
      </div>
    );
  }

  return (
    <div className={`flex-1 overflow-hidden flex flex-col min-h-0 ${t.editorBg}`}>
      { }
      <EditingIndicatorBar editingUsers={editingUsers} activeFileId={activeFileId} theme={theme} />
      <FileLockBanner activeFileLock={activeFileLock} lockedByOther={lockedByOther} lockNotice={lockNotice} theme={theme} />

      <div style={{ flex: 1, overflow: 'hidden' }} className="min-h-0 relative">
        { }
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

            
            
            
            
            
            
            
            
            try {
              if (effectiveFile) {
                const rel = relPathOf(effectiveFile, files);
                const uri = monaco.Uri.parse(
                  'file:///' + rel.split('/').map(encodeURIComponent).join('/')
                );
                let model = monaco.editor.getModel(uri);
                if (!model) {
                  model = monaco.editor.createModel(
                    sharedText ? '' : effectiveFile.content || '',
                    language,
                    uri
                  );
                } else {
                  monaco.editor.setModelLanguage(model, language);
                  if (!sharedText && model.getValue() !== (effectiveFile.content || '')) {
                    model.setValue(effectiveFile.content || '');
                  }
                }
                if (editor.getModel() !== model) editor.setModel(model);
              }
            } catch {}

            
            defineCustomEditorThemes(monaco);
            try {
              registerPremiumThemes(monaco);
            } catch {}

            
            try {
              const mLang = getMonacoLanguage(effectiveFile?.name || '');
              registerSnippetProvider(monaco, mLang);
              registerSnippetUseCommand(editor);
            } catch {}

            
            try {
              registerIntellisense(monaco);
              syncProjectFiles(monaco, files); 
            try {
              
              
              registerPrettierFormattingProvider(monaco, () => filesRef.current);
            } catch {}
            } catch {}
            try {
              registerEmmet(editor, monaco);
            } catch {}
            
            try {
              registerGhostText(monaco);
            } catch {}

            if (isPrimary) {
            try {
              const dispatchSelectionAction = (kind) => {
                try {
                  const sel = editor.getSelection();
                  const model = editor.getModel();
                  if (!sel || sel.isEmpty() || !model) return;
                  const selectionText = model.getValueInRange(sel);
                  if (!selectionText.trim()) return;
                  const list = filesRef.current && filesRef.current.length ? filesRef.current : files;
                  const file = (list || []).find((f) => f.id === effectiveFile?.id) || effectiveFile;
                  if (!file) return;
                  const startLine = sel.startLineNumber;
                  const endLine = sel.endLineNumber;
                  if (kind === 'explain') {
                    window.dispatchEvent(
                      new CustomEvent('synapse:ask-neura', {
                        detail: {
                          prompt: buildExplainSelectionPrompt({
                            fileName: file.name,
                            startLine,
                            endLine,
                            selectionText,
                          }),
                        },
                      })
                    );
                    return;
                  }
                  window.dispatchEvent(
                    new CustomEvent('synapse:neura-selection', {
                      detail: {
                        kind,
                        fileId: file.id,
                        relPath: relPathOf(file, list),
                        fileName: file.name,
                        startLine,
                        endLine,
                        selectionText,
                      },
                    })
                  );
                } catch {}
              };
              editor.addAction({
                id: 'synapse.neuraExplainSelection',
                label: 'Explain Selection',
                contextMenuGroupId: '9_neura',
                contextMenuOrder: 1,
                precondition: 'editorHasSelection',
                run: () => dispatchSelectionAction('explain'),
              });
              editor.addAction({
                id: 'synapse.neuraFixSelection',
                label: 'Fix Selection',
                contextMenuGroupId: '9_neura',
                contextMenuOrder: 2,
                precondition: 'editorHasSelection',
                run: () => dispatchSelectionAction('fix'),
              });
              editor.addAction({
                id: 'synapse.neuraRefactorSelection',
                label: 'Refactor Selection',
                contextMenuGroupId: '9_neura',
                contextMenuOrder: 3,
                precondition: 'editorHasSelection',
                run: () => dispatchSelectionAction('refactor'),
              });
            } catch {}
            }

            
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

            
            
            
            if (isPrimary) {
            try {
              bpDecoRef.current.unsubscribe?.();
              const applyBp = () => {
                try {
                  const ed = editorRef.current;
                  if (!ed) return;
                  if (bpDecoRef.current.collectionFor !== ed) {
                    bpDecoRef.current.collection = ed.createDecorationsCollection([]);
                    bpDecoRef.current.collectionFor = ed;
                  }
                  const rel = relPathOf(effectiveFile, files);
                  const lines = rel ? getBreakpoints(rel) : [];
                  bpDecoRef.current.collection.set(
                    lines.map((ln) => ({
                      range: new monaco.Range(ln, 1, ln, 1),
                      options: {
                        glyphMarginClassName: 'synapse-bp-dot',
                        glyphMarginHoverMessage: {
                          value: `Breakpoint · line ${ln}\nClick the gutter to remove`,
                        },
                      },
                    }))
                  );
                } catch {}
              };
              bpDecoRef.current.unsubscribe = subscribeBreakpoints(applyBp);
              editor.onMouseDown((e) => {
                try {
                  if (
                    e.target.type === monaco.editor.MouseTargetType.GUTTER_GLYPH_MARGIN &&
                    e.target.position
                  ) {
                    const rel = relPathOf(effectiveFile, files);
                    if (rel) toggleBreakpoint(rel, e.target.position.lineNumber);
                  }
                } catch {}
              });
              applyBp();
            } catch {}
            }

            
            
            
            
            
            
            
            
            setEditorMountKey((k) => k + 1);

            editor.onDidChangeCursorSelection((event) => {
              onCursorMove?.(event.selection.getPosition());
              
              
              
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
            readOnly: isReadOnly || !!forceReadOnly,
            domReadOnly: isReadOnly || !!forceReadOnly,
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
            glyphMargin: true,
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
            inlineSuggest: { enabled: true, mode: 'subwordSmart' },
          }}
        />
      </div>
    </div>
  );
}
