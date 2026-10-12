import { useState, useEffect, useMemo, useRef } from 'react';
import { useFiles } from '../contexts/FileContext';
import { copyText } from '../utils/clipboard';
import { getThemeClasses } from '../utils/theme';
import { exportCodeSnapshot } from '../utils/snapshot';
import { EDITOR_THEMES } from '../hooks/useEditorSettings';
import {
  Search,
  Play,
  FilePlus2,
  FolderPlus,
  Copy,
  Download,
  Sun,
  Moon,
  LogOut,
  CaseSensitive,
  WrapText,
  Map as MapIcon,
  FileCode2,
  CornerDownLeft,
  Check,
  ScanSearch,
  Camera,
  Palette,
  Eye,
} from 'lucide-react';

/**
 * VS Code-style command palette (Ctrl/⌘ + K).
 * - Fuzzy-searches project files (Enter = jump to file)
 * - One-key actions: run, new file/folder, copy/download code,
 *   font size, word wrap, minimap, theme, exit
 *
 * Run is dispatched as a window CustomEvent ('synapse:run-code')
 * which the Toolbar listens for — same bridge pattern the app
 * already uses for chat search.
 */
export default function CommandPalette({
  open,
  onClose,
  theme = 'dark',
  onToggleTheme,
  onExit,
  settings,
  onIncreaseFont,
  onDecreaseFont,
  onToggleWordWrap,
  onToggleMinimap,
  onOpenReview,
}) {
  const { files, activeFile, createFile, createFolder, openTab } = useFiles();
  const t = getThemeClasses(theme);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(0);
  const [copied, setCopied] = useState(false);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  // Reset every time it opens
  useEffect(() => {
    if (open) {
      setQuery('');
      setSelected(0);
      setCopied(false);
      const id = setTimeout(() => inputRef.current?.focus(), 30);
      return () => clearTimeout(id);
    }
  }, [open ]);

  const runAndClose = (fn) => {
    fn();
    onClose();
  };

  const handleNewFile = () => {
    const taken = new Set(files.map((f) => f.name));
    let name = 'untitled.py';
    let i = 2;
    while (taken.has(name)) name = `untitled-${i++}.py`;
    createFile(name); // auto-opens the tab + focuses it
  };

  const handleNewFolder = () => {
    const taken = new Set(files.map((f) => f.name));
    let name = 'untitled-folder';
    let i = 2;
    while (taken.has(name)) name = `untitled-folder-${i++}`;
    createFolder(name);
  };

  const handleCopyCode = async () => {
    if (!activeFile) return;
    const ok = await copyText(activeFile.content || '');
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  const handleDownload = () => {
    if (!activeFile) return;
    const blob = new Blob([activeFile.content || ''], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = activeFile.name || 'file.txt';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const [snapshotBusy, setSnapshotBusy] = useState(false);
  const handleSnapshot = async () => {
    if (!activeFile || snapshotBusy) return;
    setSnapshotBusy(true);
    try {
      await exportCodeSnapshot({ code: activeFile.content || '', filename: activeFile.name || 'code.txt' });
    } catch {
      /* canvas unavailable — silently ignore */
    } finally {
      setSnapshotBusy(false);
    }
  };

  const fileItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    return files
      .filter((f) => f.type !== 'folder')
      .filter((f) => !q || f.name.toLowerCase().includes(q))
      .slice(0, 8)
      .map((f) => ({
        key: `file-${f.id}`,
        icon: FileCode2,
        label: f.name,
        hint: f.id === activeFile?.id ? 'open' : 'jump to',
        run: () => openTab(f.id),
      }));
  }, [files, query, activeFile, openTab]);

  const actionItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    const all = [
      {
        key: 'run',
        icon: Play,
        label: 'Run code',
        hint: 'Ctrl+↵',
        run: () => window.dispatchEvent(new CustomEvent('synapse:run-code')),
      },
      {
        key: 'new-file',
        icon: FilePlus2,
        label: 'New file',
        hint: '',
        run: handleNewFile,
      },
      {
        key: 'new-folder',
        icon: FolderPlus,
        label: 'New folder',
        hint: '',
        run: handleNewFolder,
      },
      {
        key: 'copy',
        icon: copied ? Check : Copy,
        label: copied ? 'Copied!' : 'Copy active file code',
        hint: '',
        run: handleCopyCode,
      },
      {
        key: 'download',
        icon: Download,
        label: `Download ${activeFile ? activeFile.name : 'file'}`,
        hint: '',
        run: handleDownload,
      },
      {
        key: 'review',
        icon: ScanSearch,
        label: 'Review code with Neura',
        hint: 'AI',
        run: () => onOpenReview?.(),
      },
      {
        key: 'snapshot',
        icon: Camera,
        label: snapshotBusy ? 'Rendering snapshot…' : 'Export code snapshot (PNG)',
        hint: '',
        run: handleSnapshot,
      },
      {
        key: 'editor-theme',
        icon: Palette,
        label: 'Cycle editor theme',
        hint: EDITOR_THEMES.find((x) => x.id === settings?.editorTheme)?.label || 'Auto',
        run: () => window.dispatchEvent(new CustomEvent('synapse:cycle-editor-theme')),
      },
      {
        key: 'zen',
        icon: Eye,
        label: 'Toggle zen mode',
        hint: 'focus',
        run: () => window.dispatchEvent(new CustomEvent('synapse:toggle-zen')),
      },
      {
        key: 'font-up',
        icon: CaseSensitive,
        label: 'Increase font size',
        hint: `${settings?.fontSize ?? 15}px`,
        run: onIncreaseFont,
      },
      {
        key: 'font-down',
        icon: CaseSensitive,
        label: 'Decrease font size',
        hint: `${settings?.fontSize ?? 15}px`,
        run: onDecreaseFont,
      },
      {
        key: 'wrap',
        icon: WrapText,
        label: `${settings?.wordWrap === 'on' ? 'Disable' : 'Enable'} word wrap`,
        hint: settings?.wordWrap === 'on' ? 'on' : 'off',
        run: onToggleWordWrap,
      },
      {
        key: 'minimap',
        icon: MapIcon,
        label: `${settings?.minimap ? 'Hide' : 'Show'} minimap`,
        hint: settings?.minimap ? 'on' : 'off',
        run: onToggleMinimap,
      },
      {
        key: 'theme',
        icon: theme === 'dark' ? Sun : Moon,
        label: `Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`,
        hint: '',
        run: onToggleTheme,
      },
      ...(onExit
        ? [
            {
              key: 'exit',
              icon: LogOut,
              label: 'Exit to dashboard',
              hint: '',
              run: onExit,
            },
          ]
        : []),
    ];
    return all.filter((a) => !q || a.label.toLowerCase().includes(q));
  }, [query, theme, settings, activeFile, copied, snapshotBusy, onToggleTheme, onExit, onIncreaseFont, onDecreaseFont, onToggleWordWrap, onToggleMinimap, onOpenReview]);

  const sections = useMemo(() => {
    const out = [];
    if (fileItems.length) out.push({ title: 'Files', items: fileItems });
    if (actionItems.length) out.push({ title: 'Actions', items: actionItems });
    return out;
  }, [fileItems, actionItems]);

  const flat = useMemo(() => sections.flatMap((s) => s.items), [sections]);

  useEffect(() => {
    setSelected(0);
  }, [query]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // Keep the highlighted row visible
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-idx="${selected}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [selected]);

  if (!open) return null;

  const onInputKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelected((s) => Math.min(flat.length - 1, s + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelected((s) => Math.max(0, s - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const item = flat[selected];
      if (item) runAndClose(item.run);
    }
  };

  let idx = -1;

  return (
    <div
      className="fixed inset-0 z-200 flex justify-center px-4 pt-[16vh] bg-black/60 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl h-fit syn-glass-strong rounded-2xl overflow-hidden shadow-[0_32px_90px_-16px_rgba(0,0,0,0.85)] animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input */}
        <div className={`flex items-center gap-3 px-5 py-4 border-b ${t.border}`}>
          <Search size={17} className="text-violet-400 shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onInputKeyDown}
            placeholder="Type a command or search files…"
            className="flex-1 bg-transparent outline-none text-sm text-slate-100 placeholder:text-slate-600"
          />
          <span className={t.kbd}>esc</span>
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-[46vh] overflow-y-auto p-2">
          {flat.length === 0 && (
            <p className={`text-center text-sm ${t.textMuted} py-8`}>
              No results for “{query}”
            </p>
          )}
          {sections.map((section) => (
            <div key={section.title} className="mb-1">
              <p
                className={`px-3 pt-2.5 pb-1 text-[10px] font-bold uppercase tracking-[0.18em] ${t.textMuted}`}
              >
                {section.title}
              </p>
              {section.items.map((item) => {
                idx += 1;
                const myIdx = idx;
                const Icon = item.icon;
                const isSel = myIdx === selected;
                return (
                  <button
                    key={item.key}
                    data-idx={myIdx}
                    onClick={() => runAndClose(item.run)}
                    onMouseEnter={() => setSelected(myIdx)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left text-sm cursor-pointer transition-colors duration-100 ${
                      isSel
                        ? theme === 'dark'
                          ? 'bg-violet-500/[0.14] text-white'
                          : 'bg-violet-50 text-slate-900'
                        : t.textSecondary
                    }`}
                  >
                    <span
                      className={`p-1.5 rounded-lg shrink-0 ${
                        isSel
                          ? 'bg-violet-500/20 text-violet-300'
                          : theme === 'dark'
                            ? 'bg-white/5 text-slate-500'
                            : 'bg-slate-100 text-slate-400'
                      }`}
                    >
                      <Icon size={14} />
                    </span>
                    <span className="flex-1 truncate font-medium">{item.label}</span>
                    {item.hint && (
                      <span className={`${t.kbd} shrink-0`}>{item.hint}</span>
                    )}
                    {isSel && (
                      <CornerDownLeft size={13} className="text-violet-400 shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        {/* Footer hints */}
        <div
          className={`flex items-center gap-4 px-5 py-2.5 border-t ${t.border} text-[11px] ${t.textMuted}`}
        >
          <span className="flex items-center gap-1.5">
            <span className={t.kbd}>↑↓</span> navigate
          </span>
          <span className="flex items-center gap-1.5">
            <span className={t.kbd}>↵</span> select
          </span>
          <span className="flex items-center gap-1.5">
            <span className={t.kbd}>esc</span> close
          </span>
        </div>
      </div>
    </div>
  );
}
