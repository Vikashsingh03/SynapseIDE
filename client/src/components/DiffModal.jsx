import { useEffect, useMemo, useRef, useState } from 'react';
import loader from '@monaco-editor/loader';
import {
  X,
  GitCompare,
  Columns2,
  Rows2,
  ClipboardPaste,
  Check,
  FileWarning,
} from 'lucide-react';
import { useFiles } from '../contexts/FileContext';
import { getMonacoLanguage } from '../utils/languageMap';
import { getThemeClasses } from '../utils/theme';
import { useEditorSettings, fontStackFor } from '../hooks/useEditorSettings';

const APP_LANGUAGE_EXTS = new Set(['py', 'js', 'cpp', 'java']);

const EXTRA_LANGUAGES = {
  jsx: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  ts: 'typescript',
  tsx: 'typescript',
  json: 'json',
  html: 'html',
  htm: 'html',
  css: 'css',
  scss: 'scss',
  less: 'less',
  md: 'markdown',
  markdown: 'markdown',
  xml: 'xml',
  svg: 'xml',
  yaml: 'yaml',
  yml: 'yaml',
  sql: 'sql',
  sh: 'shell',
  bash: 'shell',
  c: 'cpp',
  h: 'cpp',
  hpp: 'cpp',
  txt: 'plaintext',
};

function diffLanguageFor(name) {
  const lower = (name || '').toLowerCase();
  const ext = lower.includes('.') ? lower.split('.').pop() : '';
  if (APP_LANGUAGE_EXTS.has(ext)) return getMonacoLanguage(lower);
  return EXTRA_LANGUAGES[ext] || 'plaintext';
}

export default function DiffModal({ open, mode = 'files', onClose, theme = 'dark' }) {
  const { files, activeFile } = useFiles();
  const { settings } = useEditorSettings();
  const t = getThemeClasses(theme);
  const containerRef = useRef(null);
  const editorRef = useRef(null);
  const sideBySideRef = useRef(true);

  const [phase, setPhase] = useState('init');
  const [sideBySide, setSideBySide] = useState(true);
  const [pasteText, setPasteText] = useState('');
  const [clipOriginal, setClipOriginal] = useState({ name: '', text: '' });
  const [clipModified, setClipModified] = useState('');
  const [origId, setOrigId] = useState(null);
  const [modId, setModId] = useState(null);

  const monacoTheme =
    settings?.editorTheme && settings.editorTheme !== 'auto'
      ? settings.editorTheme
      : theme === 'dark'
        ? 'vs-dark'
        : 'vs';

  const nonFolderFiles = useMemo(
    () => files.filter((f) => f.type !== 'folder'),
    [files]
  );

  useEffect(() => {
    if (!open) return;
    setSideBySide(true);
    sideBySideRef.current = true;
    setPasteText('');
    setClipModified('');
    if (mode === 'clipboard') {
      if (!activeFile) {
        setPhase('nofile');
        return undefined;
      }
      setClipOriginal({ name: activeFile.name || 'untitled', text: activeFile.content || '' });
      setPhase('init');
      let cancelled = false;
      const fallback = () => {
        if (!cancelled) setPhase('paste');
      };
      if (navigator.clipboard && typeof navigator.clipboard.readText === 'function') {
        navigator.clipboard
          .readText()
          .then((text) => {
            if (cancelled) return;
            setClipModified(text || '');
            setPhase('diff');
          })
          .catch(fallback);
      } else {
        fallback();
      }
      return () => {
        cancelled = true;
      };
    }
    const list = files.filter((f) => f.type !== 'folder');
    if (!list.length) {
      setPhase('empty');
      return undefined;
    }
    const first =
      activeFile && list.some((f) => f.id === activeFile.id) ? activeFile.id : list[0].id;
    const second = (list.find((f) => f.id !== first) || list[0]).id;
    setOrigId(first);
    setModId(second);
    setPhase('diff');
    return undefined;
  }, [open, mode]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  let origName = '';
  let modName = '';
  let origText = '';
  let modText = '';
  if (mode === 'clipboard') {
    origName = clipOriginal.name;
    origText = clipOriginal.text;
    modName = 'Clipboard';
    modText = clipModified;
  } else {
    const o = nonFolderFiles.find((f) => f.id === origId);
    const m = nonFolderFiles.find((f) => f.id === modId);
    origName = o?.name || '';
    origText = o?.content || '';
    modName = m?.name || '';
    modText = m?.content || '';
  }

  const showDiff = open && phase === 'diff';
  const identical = showDiff && origText === modText;

  useEffect(() => {
    if (!showDiff) return undefined;
    let cancelled = false;
    loader
      .init()
      .then((monaco) => {
        if (cancelled || !containerRef.current) return;
        const original = monaco.editor.createModel(origText, diffLanguageFor(origName));
        const modified = monaco.editor.createModel(modText, diffLanguageFor(modName));
        const editor = monaco.editor.createDiffEditor(containerRef.current, {
          readOnly: true,
          originalEditable: false,
          renderSideBySide: sideBySideRef.current,
          automaticLayout: true,
          theme: monacoTheme,
          fontSize: settings?.fontSize ?? 15,
          fontFamily: fontStackFor(settings?.fontFamily),
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
        });
        editor.setModel({ original, modified });
        editorRef.current = { editor, original, modified };
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      if (editorRef.current) {
        const handles = editorRef.current;
        editorRef.current = null;
        try {
          handles.editor.dispose();
        } catch {}
        try {
          handles.original.dispose();
        } catch {}
        try {
          handles.modified.dispose();
        } catch {}
      }
    };
  }, [showDiff, origText, modText, origName, modName, monacoTheme, settings?.fontSize, settings?.fontFamily]);

  useEffect(() => {
    sideBySideRef.current = sideBySide;
    if (editorRef.current) {
      try {
        editorRef.current.editor.updateOptions({ renderSideBySide: sideBySide });
      } catch {}
    }
  }, [sideBySide]);

  if (!open) return null;

  const cardClass =
    theme === 'dark'
      ? 'bg-[#1b1d19] rounded-xl border border-[#343730] shadow-[0_30px_90px_rgba(0,0,0,0.5)] animate-spring-in'
      : 'bg-white rounded-xl border border-[#d6d4cc] shadow-[0_30px_90px_rgba(20,21,20,0.2)] animate-spring-in';

  const toggleBtn = (active) =>
    `flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-bold transition-colors cursor-pointer ${
      active ? 'bg-(--blue)/12 text-(--blue)' : `${t.textMuted} hover:text-(--ink)`
    }`;

  return (
    <div className={t.modalOverlay} onClick={onClose}>
      <div
        className={`${cardClass} w-[min(1150px,96vw)] h-[88vh] flex flex-col overflow-hidden`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={`flex items-center gap-3 px-5 py-3.5 border-b ${t.border} shrink-0`}>
          <span className="flex items-center justify-center w-9 h-9 rounded-md border bg-(--blue)/10 border-(--blue)/30 shrink-0">
            <GitCompare size={17} className="text-(--blue)" />
          </span>
          <div className="flex-1 min-w-0">
            <h2 className={`text-sm font-extrabold ${t.textPrimary}`}>Diff Compare</h2>
            <p className={`text-xs ${t.textMuted} truncate font-mono`}>
              {mode === 'clipboard'
                ? `${origName || 'no file'}  →  Clipboard`
                : `${origName || '—'}  →  ${modName || '—'}`}
            </p>
          </div>
          {phase === 'diff' && (
            <div className={`flex rounded-lg border ${t.border} overflow-hidden shrink-0`}>
              <button onClick={() => setSideBySide(true)} className={toggleBtn(sideBySide)} title="Side by side">
                <Columns2 size={13} /> Side by Side
              </button>
              <button onClick={() => setSideBySide(false)} className={toggleBtn(!sideBySide)} title="Inline">
                <Rows2 size={13} /> Inline
              </button>
            </div>
          )}
          <button onClick={onClose} className={t.iconBtn} title="Close">
            <X size={16} />
          </button>
        </div>

        {mode === 'files' && phase === 'diff' && (
          <div className={`flex items-center gap-3 px-5 py-3 border-b ${t.border} shrink-0`}>
            <label className="flex-1 flex items-center gap-2 min-w-0">
              <span className={t.eyebrow}>Original</span>
              <select
                value={origId ?? ''}
                onChange={(e) => setOrigId(e.target.value)}
                className={t.input}
              >
                {nonFolderFiles.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex-1 flex items-center gap-2 min-w-0">
              <span className={t.eyebrow}>Modified</span>
              <select
                value={modId ?? ''}
                onChange={(e) => setModId(e.target.value)}
                className={t.input}
              >
                {nonFolderFiles.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}

        {identical && (
          <div className={`flex items-center gap-2 px-5 py-2 border-b ${t.border} shrink-0`}>
            <Check size={13} className="text-emerald-500 shrink-0" />
            <p className={`text-xs ${t.textMuted}`}>
              No differences — the two contents are identical.
            </p>
          </div>
        )}

        <div className="flex-1 min-h-0 flex flex-col">
          {phase === 'nofile' && (
            <div className="flex flex-col items-center gap-3 py-14 animate-fade-in">
              <span className="w-10 h-10 rounded-md border border-(--line) flex items-center justify-center">
                <FileWarning size={18} className="text-amber-500" />
              </span>
              <p className={`text-sm ${t.textMuted} text-center max-w-sm`}>
                No file is open right now. Open a file first, then run Compare Active File with Clipboard.
              </p>
            </div>
          )}

          {phase === 'empty' && (
            <div className="flex flex-col items-center gap-3 py-14 animate-fade-in">
              <span className="w-10 h-10 rounded-md border border-(--line) flex items-center justify-center">
                <FileWarning size={18} className="text-amber-500" />
              </span>
              <p className={`text-sm ${t.textMuted} text-center max-w-sm`}>
                This project has no files to compare yet. Create a file first, then try again.
              </p>
            </div>
          )}

          {phase === 'init' && (
            <div className="flex flex-col items-center gap-3 py-14 animate-fade-in">
              <ClipboardPaste size={22} className={t.textMuted} />
              <p className={`text-sm font-mono ${t.textMuted}`}>Reading clipboard…</p>
            </div>
          )}

          {phase === 'paste' && (
            <div className="flex flex-col gap-3 p-5 animate-fade-in">
              <p className={`text-sm ${t.textMuted} max-w-2xl`}>
                The browser did not allow reading the clipboard directly. Paste the text you want to
                compare against <span className="font-bold font-mono">{origName}</span> below, then
                press Compare.
              </p>
              <textarea
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                placeholder="Paste text here…"
                className={`${t.input} flex-1 min-h-[220px] font-mono resize-none custom-scrollbar`}
                autoFocus
              />
              <div className="flex justify-end">
                <button
                  onClick={() => {
                    setClipModified(pasteText);
                    setPhase('diff');
                  }}
                  className={t.btnPrimary}
                >
                  <GitCompare size={14} /> Compare
                </button>
              </div>
            </div>
          )}

          {phase === 'diff' && <div ref={containerRef} className="flex-1 min-h-0" />}
        </div>

        <div className={`flex items-center justify-between px-5 py-3 border-t ${t.border} shrink-0`}>
          <p className={`text-[11px] ${t.textMuted}`}>
            {sideBySide ? 'Original on the left · Modified on the right' : 'Inline view · changes marked in place'}
          </p>
          <button onClick={onClose} className={t.btnSecondary}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export function DiffHost({ theme = 'dark' }) {
  const [mode, setMode] = useState(null);
  useEffect(() => {
    const onOpen = (e) => setMode(e.detail?.mode === 'clipboard' ? 'clipboard' : 'files');
    window.addEventListener('synapse:open-diff', onOpen);
    return () => window.removeEventListener('synapse:open-diff', onOpen);
  }, []);
  if (!mode) return null;
  return <DiffModal open mode={mode} onClose={() => setMode(null)} theme={theme} />;
}
