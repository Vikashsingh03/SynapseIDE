import { useState, useEffect, useMemo, useRef } from 'react';
import { useFiles } from '../contexts/FileContext';
import { copyText } from '../utils/clipboard';
import { getThemeClasses } from '../utils/theme';
import { exportCodeSnapshot } from '../utils/snapshot';
import { EDITOR_THEMES } from '../hooks/useEditorSettings';
import FileIcon from './FileIcon';
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
  Code2,
  BookmarkPlus,
  LayoutTemplate,
  Trophy,
  Space,
  Wand2,
  Pin,
  Replace,
  Bug,
  XCircle,
  Type,
  Puzzle,
  Blocks,
  NotebookPen,
  Globe,
  Database,
  Rocket,
  Container,
  ListChecks,
  Ghost,
  Monitor,
  FlaskConical,
  History,
  BookOpen,
  GitCompare,
  ClipboardPaste,
} from 'lucide-react';
import { fontLabelFor } from '../hooks/useEditorSettings';
import { getExtensionCommands } from '../extensions/registry';
import { ghostTextEnabled, setGhostTextEnabled } from '../editor/ghostText';











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
  onCycleFontFamily,
  onCycleTabSize,
  onToggleFormatOnType,
  onToggleStickyScroll,
  onOpenReview,
}) {
  const { files, activeFile, createFile, createFolder, openTab, updateContent } = useFiles();
  const t = getThemeClasses(theme);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(0);
  const [copied, setCopied] = useState(false);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  
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
    createFile(name); 
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
        icon: () => <FileIcon name={f.name} size={16} />,
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
        key: 'new-project',
        icon: LayoutTemplate,
        label: 'New Project from Template…',
        hint: 'React · Node · Python · more',
        run: () => window.dispatchEvent(new Event('synapse:new-project')),
      },
      {
        key: 'practice',
        icon: Trophy,
        label: 'Practice Coding Problems',
        hint: 'DSA Arena',
        run: () => window.dispatchEvent(new Event('synapse:open-practice')),
      },
      {
        key: 'rename-symbol',
        icon: Replace,
        label: 'Rename Symbol in Project…',
        hint: 'all files',
        run: () => window.dispatchEvent(new Event('synapse:rename-symbol')),
      },
      {
        key: 'run-debug',
        icon: Bug,
        label: 'Run & Debug',
        hint: 'terminal',
        run: () => window.dispatchEvent(new Event('synapse:open-debug')),
      },
      {
        key: 'extensions',
        icon: Blocks,
        label: 'Extensions',
        hint: 'built-in',
        run: () => window.dispatchEvent(new Event('synapse:open-extensions')),
      },
      {
        key: 'notebook',
        icon: NotebookPen,
        label: 'Open Notebook',
        hint: 'cells · python/js',
        run: () => window.dispatchEvent(new Event('synapse:open-notebook')),
      },
      {
        key: 'rest-client',
        icon: Globe,
        label: 'REST Client',
        hint: 'api tester',
        run: () => window.dispatchEvent(new Event('synapse:open-rest')),
      },
      {
        key: 'db-viewer',
        icon: Database,
        label: 'Database Viewer',
        hint: 'mongodb · read-only',
        run: () => window.dispatchEvent(new Event('synapse:open-db')),
      },
      {
        key: 'deploy',
        icon: Rocket,
        label: 'Deploy',
        hint: 'vercel · render · netlify · docker',
        run: () => window.dispatchEvent(new Event('synapse:open-deploy')),
      },
      {
        key: 'docker',
        icon: Container,
        label: 'Docker',
        hint: 'containers · images · logs',
        run: () => window.dispatchEvent(new Event('synapse:open-docker')),
      },
      {
        key: 'live-preview',
        icon: Monitor,
        label: 'Live Preview',
        hint: 'html preview',
        run: () => window.dispatchEvent(new Event('synapse:open-preview')),
      },
      {
        key: 'tests',
        icon: FlaskConical,
        label: 'Test Explorer',
        hint: 'node:test',
        run: () => window.dispatchEvent(new Event('synapse:open-tests')),
      },
      {
        key: 'timeline',
        icon: History,
        label: 'Timeline: Local History',
        hint: 'file versions',
        run: () => window.dispatchEvent(new Event('synapse:open-timeline')),
      },
      {
        key: 'ghost-text',
        icon: Ghost,
        label: 'Toggle AI Completions (Ghost Text)',
        hint: ghostTextEnabled() ? 'on' : 'off',
        run: () => setGhostTextEnabled(!ghostTextEnabled()),
      },
      {
        key: 'tasks',
        icon: ListChecks,
        label: 'Tasks: Run Task…',
        hint: 'tasks.json',
        run: () => window.dispatchEvent(new Event('synapse:open-tasks')),
      },
      {
        key: 'problems',
        icon: XCircle,
        label: 'Show Problems',
        hint: 'errors & warnings',
        run: () => window.dispatchEvent(new Event('synapse:open-problems')),
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
        key: 'generate-readme',
        icon: BookOpen,
        label: 'Generate README with Neura',
        hint: 'README.md',
        run: () => window.dispatchEvent(new Event('synapse:generate-readme')),
      },
      {
        key: 'diff-clipboard',
        icon: ClipboardPaste,
        label: 'Compare Active File with Clipboard',
        hint: 'Diff',
        run: () =>
          window.dispatchEvent(
            new CustomEvent('synapse:open-diff', { detail: { mode: 'clipboard' } })
          ),
      },
      {
        key: 'diff-files',
        icon: GitCompare,
        label: 'Compare Two Files',
        hint: 'Diff',
        run: () =>
          window.dispatchEvent(
            new CustomEvent('synapse:open-diff', { detail: { mode: 'files' } })
          ),
      },
      {
        key: 'snippets',
        icon: Code2,
        label: 'Snippets: browse & insert',
        hint: 'Tab',
        run: () => window.dispatchEvent(new CustomEvent('synapse:open-snippets')),
      },
      {
        key: 'snippet-save',
        icon: BookmarkPlus,
        label: 'Snippets: save selection as snippet',
        hint: '',
        run: () => window.dispatchEvent(new CustomEvent('synapse:collect-selection')),
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
      ...(onCycleFontFamily
        ? [
            {
              key: 'editor-font',
              icon: Type,
              label: `Editor font: ${fontLabelFor(settings?.fontFamily)}`,
              hint: 'cycle',
              run: onCycleFontFamily,
            },
          ]
        : []),
      ...(onCycleTabSize
        ? [
            {
              key: 'tab-size',
              icon: Space,
              label: `Tab size: ${settings?.tabSize ?? 4} spaces`,
              hint: 'cycle 2 → 4 → 8',
              run: onCycleTabSize,
            },
          ]
        : []),
      ...(onToggleFormatOnType
        ? [
            {
              key: 'format-on-type',
              icon: Wand2,
              label: `${settings?.formatOnType ? 'Disable' : 'Enable'} format on type`,
              hint: settings?.formatOnType ? 'on' : 'off',
              run: onToggleFormatOnType,
            },
          ]
        : []),
      ...(onToggleStickyScroll
        ? [
            {
              key: 'sticky-scroll',
              icon: Pin,
              label: `${settings?.stickyScroll === false ? 'Enable' : 'Disable'} sticky scroll`,
              hint: settings?.stickyScroll === false ? 'off' : 'on',
              run: onToggleStickyScroll,
            },
          ]
        : []),
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
    
    try {
      const extCtx = { files, activeFile, openTab, updateContent, createFile, createFolder };
      all.push(
        ...getExtensionCommands(extCtx).map((c) => ({
          key: c.key,
          icon: Puzzle,
          label: c.label,
          hint: c.hint || '',
          run: c.run,
        }))
      );
    } catch {
       
    }
    return all.filter((a) => !q || a.label.toLowerCase().includes(q));
  }, [query, theme, settings, activeFile, copied, snapshotBusy, files, updateContent, openTab, createFile, createFolder, onToggleTheme, onExit, onIncreaseFont, onDecreaseFont, onToggleWordWrap, onToggleMinimap, onCycleFontFamily, onCycleTabSize, onToggleFormatOnType, onToggleStickyScroll, onOpenReview]);

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
      className="fixed inset-0 z-100 flex justify-center px-4 pt-[16vh] bg-black/60 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl h-fit rounded-xl border border-(--line) overflow-hidden shadow-[0_30px_90px_rgba(20,21,20,0.25)] animate-spring-in bg-(--paper-2)"
        onClick={(e) => e.stopPropagation()}
      >
        { }
        <div className={`flex items-center gap-3 px-5 py-4 border-b ${t.border}`}>
          <Search size={17} className={`${t.textMuted} shrink-0`} />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onInputKeyDown}
            placeholder="Type a command or search files…"
            className={`flex-1 bg-transparent outline-none text-sm ${t.textPrimary} placeholder:${t.textMuted}`}
          />
          <span className={t.kbd}>esc</span>
        </div>

        { }
        <div ref={listRef} className="max-h-[46vh] overflow-y-auto p-2 custom-scrollbar">
          {flat.length === 0 && (
            <p className={`text-center text-sm ${t.textMuted} py-8`}>
              No results for “{query}”
            </p>
          )}
          {sections.map((section) => (
            <div key={section.title} className="mb-1">
              <p className={`px-3 pt-2.5 pb-1 ${t.eyebrow}`}>
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
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-left text-sm cursor-pointer transition-colors duration-150 ${
                      isSel
                        ? 'bg-(--blue)/8 text-(--ink)'
                        : 'text-(--muted)'
                    }`}
                  >
                    <span
                      className={`p-1.5 rounded-md shrink-0 border ${
                        isSel
                          ? 'bg-(--blue)/10 border-(--blue)/30 text-(--blue)'
                          : 'bg-(--ink)/3 border-(--line) text-(--muted)'
                      }`}
                    >
                      <Icon size={14} />
                    </span>
                    <span className="flex-1 truncate font-bold">{item.label}</span>
                    {item.hint && (
                      <span className={`${t.kbd} shrink-0 font-mono`}>{item.hint}</span>
                    )}
                    {isSel && (
                      <CornerDownLeft size={13} className="text-(--muted) shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        { }
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
