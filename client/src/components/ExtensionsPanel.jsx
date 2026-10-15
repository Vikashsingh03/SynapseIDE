import { useState, useEffect, useMemo } from 'react';
import { useFiles } from '../contexts/FileContext';
import {
  EXTENSIONS,
  isExtensionEnabled,
  setExtensionEnabled,
} from '../extensions/registry';
import { renderMarkdown } from '../utils/miniMarkdown';
import {
  X,
  Blocks,
  Highlighter,
  Braces,
  BookOpen,
  WholeWord,
  Wand2,
  Table2,
  ListTodo,
  FileCode2,
  Info,
  CheckCircle2,
  XCircle,
} from 'lucide-react';

const EXT_ICONS = { Highlighter, Braces, BookOpen, WholeWord, Wand2, Table2, ListTodo, FileCode2 };

function extIconComponent(name) {
  return EXT_ICONS[name] || Blocks;
}

 
 
 

export default function ExtensionsPanel({ onClose }) {
  
  const [, setTick] = useState(0);

  const toggle = (id) => {
    const next = !isExtensionEnabled(id);
    setExtensionEnabled(id, next);
    if (id === 'todo-highlighter' && !next) {
      
      window.dispatchEvent(
        new CustomEvent('synapse:ext-decorations', {
          detail: { extensionId: 'todo-highlighter', items: [] },
        })
      );
    }
    setTick((t) => t + 1);
  };

  return (
    <div className="flex flex-col h-full">
      { }
      <div className="flex items-center gap-2.5 px-5 py-4 border-b border-(--line) shrink-0">
        <span className="p-1.5 rounded-lg bg-(--blue)/10 border border-(--blue)/25 text-(--blue)">
          <Blocks size={16} />
        </span>
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-bold text-(--ink)">Extensions</h2>
          <p className="text-[11px] text-(--muted)">Supercharge your editor</p>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-md text-(--muted) hover:text-(--ink) hover:bg-(--ink)/5 transition-colors cursor-pointer"
          aria-label="Close extensions"
        >
          <X size={16} />
        </button>
      </div>

      { }
      <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
        {EXTENSIONS.map((ext) => {
          const enabled = isExtensionEnabled(ext.id);
          const Icon = extIconComponent(ext.icon);
          return (
            <div
              key={ext.id}
              className={`rounded-xl border p-4 transition-colors ${
                enabled
                  ? 'bg-(--paper) border-(--line)'
                  : 'bg-(--paper) border-(--line) opacity-60'
              }`}
            >
              <div className="flex items-start gap-3">
                <span
                  className={`p-2.5 rounded-lg shrink-0 ${
                    enabled
                      ? 'bg-(--acid)/10 border border-(--acid)/25 text-(--acid)'
                      : 'bg-(--ink)/5 border border-(--line) text-(--muted)'
                  }`}
                >
                  <Icon size={18} />
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-(--ink) truncate">
                      {ext.name}
                    </h3>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-(--ink)/5 border border-(--line) text-(--muted) shrink-0">
                      v{ext.version}
                    </span>
                  </div>
                  <p className="text-xs text-(--muted) mt-1 leading-relaxed">
                    {ext.description}
                  </p>
                  <button
                    onClick={() => toggle(ext.id)}
                    className={`mt-3 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                      enabled
                        ? 'bg-(--acid)/10 border-(--acid)/30 text-(--acid) hover:bg-(--acid)/20'
                        : 'bg-(--ink)/5 border-(--line) text-(--muted) hover:text-(--ink)'
                    }`}
                  >
                    {enabled ? 'Disable' : 'Enable'}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      { }
      <div className="px-5 py-3.5 border-t border-(--line) shrink-0">
        <p className="text-[11px] text-(--muted) leading-relaxed">
          Extensions are built into Synapse — more coming soon.
        </p>
      </div>
    </div>
  );
}

 
 
 

function MarkdownPreviewDrawer({ onClose }) {
  const { files, activeFile } = useFiles();
  
  const [fileId] = useState(() => activeFile?.id);
  const file =
    files.find((f) => f.id === fileId) ||
    (activeFile?.name?.endsWith('.md') ? activeFile : null);
  const content = file?.content || '';

  const html = useMemo(() => {
    try {
      return renderMarkdown(content);
    } catch {
      return '';
    }
  }, [content]);

  return (
    <div className="fixed inset-y-0 right-0 w-[520px] max-w-[94vw] z-[70] bg-(--paper-2) border-l border-(--line) flex flex-col shadow-[0_0_48px_rgba(0,0,0,0.45)] animate-fade-in">
      <div className="flex items-center gap-2.5 px-5 py-4 border-b border-(--line) shrink-0">
        <span className="p-1.5 rounded-lg bg-(--blue)/10 border border-(--blue)/25 text-(--blue)">
          <BookOpen size={16} />
        </span>
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-bold text-(--ink) truncate">
            {file?.name || 'Markdown Preview'}
          </h2>
          <p className="text-[11px] text-(--muted)">live preview</p>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-md text-(--muted) hover:text-(--ink) hover:bg-(--ink)/5 transition-colors cursor-pointer"
          aria-label="Close preview"
        >
          <X size={16} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
        <div
          className="md-preview text-sm text-(--ink) leading-relaxed
            [&_h1]:text-2xl [&_h1]:font-bold [&_h1]:mt-2 [&_h1]:mb-3
            [&_h2]:text-xl [&_h2]:font-bold [&_h2]:mt-6 [&_h2]:mb-2
            [&_h3]:text-lg [&_h3]:font-bold [&_h3]:mt-4 [&_h3]:mb-2
            [&_p]:my-2.5
            [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:my-2 [&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:my-2 [&_li]:my-1
            [&_a]:text-(--blue) [&_a]:underline
            [&_blockquote]:border-l-2 [&_blockquote]:border-(--line) [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-(--muted) [&_blockquote]:my-3
            [&_code]:font-mono [&_code]:text-[13px] [&_code]:bg-(--ink)/8 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded
            [&_pre]:bg-black/30 [&_pre]:border [&_pre]:border-(--line) [&_pre]:p-4 [&_pre]:rounded-xl [&_pre]:overflow-x-auto [&_pre]:my-4
            [&_pre_code]:bg-transparent [&_pre_code]:p-0
            [&_hr]:my-6 [&_hr]:border-(--line)
            [&_table]:w-full [&_table]:my-4 [&_th]:text-left [&_th]:border-b [&_th]:border-(--line) [&_th]:pb-2 [&_th]:pr-4
            [&_td]:border-b [&_td]:border-(--line)/60 [&_td]:py-2 [&_td]:pr-4"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </div>
    </div>
  );
}

 
 
 

function TodoExplorerDrawer({ items, onClose }) {
  const { openTab } = useFiles();

  const gotoItem = (it) => {
    try {
      openTab(it.fileId);
      
      
      
      setTimeout(() => {
        try {
          window.dispatchEvent(
            new CustomEvent('synapse:goto-line', { detail: { line: it.line } })
          );
        } catch {}
      }, 150);
    } catch {}
    onClose();
  };

  return (
    <div className="fixed inset-y-0 right-0 w-[480px] max-w-[94vw] z-[70] bg-(--paper-2) border-l border-(--line) flex flex-col shadow-[0_0_48px_rgba(0,0,0,0.45)] animate-fade-in">
      <div className="flex items-center gap-2.5 px-5 py-4 border-b border-(--line) shrink-0">
        <span className="p-1.5 rounded-lg bg-(--acid)/10 border border-(--acid)/25 text-(--acid)">
          <ListTodo size={16} />
        </span>
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-bold text-(--ink)">TODO Explorer</h2>
          <p className="text-[11px] text-(--muted)">
            {items.length} item{items.length === 1 ? '' : 's'} in project
          </p>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-md text-(--muted) hover:text-(--ink) hover:bg-(--ink)/5 transition-colors cursor-pointer"
          aria-label="Close TODO explorer"
        >
          <X size={16} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-1.5 custom-scrollbar">
        {items.map((it, idx) => (
          <button
            key={`${it.fileId}-${it.line}-${idx}`}
            onClick={() => gotoItem(it)}
            className="w-full text-left rounded-lg border border-transparent hover:border-(--line) hover:bg-(--paper) px-3 py-2.5 transition-colors cursor-pointer group"
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-[12px] font-mono text-(--blue) truncate">
                {it.fileName}
                <span className="text-(--muted)">:{it.line}</span>
              </span>
              <span
                className={`ml-auto shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                  it.kind === 'fixme'
                    ? 'bg-red-500/10 text-red-400 border-red-500/30'
                    : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                }`}
              >
                {it.kind === 'fixme' ? 'FIXME' : 'TODO'}
              </span>
            </div>
            <p className="text-[12px] text-(--muted) mt-1 truncate group-hover:text-(--ink)">
              {it.text}
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}

 
 
 

const TOAST_ICONS = { info: Info, success: CheckCircle2, error: XCircle };

function ToastStack({ toasts }) {
  if (!toasts.length) return null;
  return (
    <div className="fixed bottom-6 right-6 z-[120] flex flex-col gap-2 items-end pointer-events-none">
      {toasts.map((t) => {
        const Icon = TOAST_ICONS[t.kind] || Info;
        const isError = t.kind === 'error';
        return (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-center gap-2.5 pl-3 pr-4 py-2.5 rounded-xl bg-[#14181f] border shadow-[0_12px_36px_rgba(0,0,0,0.5)] animate-fade-in max-w-[340px] ${
              isError ? 'border-red-500/60' : 'border-white/10'
            }`}
          >
            <Icon
              size={15}
              className={`shrink-0 ${
                isError
                  ? 'text-red-400'
                  : t.kind === 'success'
                    ? 'text-emerald-400'
                    : 'text-sky-400'
              }`}
            />
            <span className="text-[13px] text-white/90 leading-snug break-words">
              {t.message}
            </span>
          </div>
        );
      })}
    </div>
  );
}

 
 
 

export function ExtensionsHost() {
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [mdOpen, setMdOpen] = useState(false);
  const [todoItems, setTodoItems] = useState(null); 
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    const openGallery = () => setGalleryOpen(true);
    const openMd = () => setMdOpen(true);
    const openTodos = (e) => {
      const items = e?.detail?.items;
      if (items && items.length) setTodoItems(items);
    };
    const onToast = (e) => {
      const { message, kind = 'info' } = e?.detail || {};
      if (!message) return;
      const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      setToasts((prev) => [...prev.slice(-4), { id, message, kind }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((x) => x.id !== id));
      }, 3500);
    };
    window.addEventListener('synapse:open-extensions', openGallery);
    window.addEventListener('synapse:ext-open-markdown', openMd);
    window.addEventListener('synapse:ext-open-todos', openTodos);
    window.addEventListener('synapse:ext-toast', onToast);
    return () => {
      window.removeEventListener('synapse:open-extensions', openGallery);
      window.removeEventListener('synapse:ext-open-markdown', openMd);
      window.removeEventListener('synapse:ext-open-todos', openTodos);
      window.removeEventListener('synapse:ext-toast', onToast);
    };
  }, []);

  return (
    <>
      {galleryOpen && (
        <div className="fixed inset-y-0 right-0 w-[440px] max-w-[92vw] z-[70] bg-(--paper-2) border-l border-(--line) flex flex-col shadow-[0_0_48px_rgba(0,0,0,0.45)] animate-fade-in">
          <ExtensionsPanel onClose={() => setGalleryOpen(false)} />
        </div>
      )}
      {mdOpen && <MarkdownPreviewDrawer onClose={() => setMdOpen(false)} />}
      {todoItems && (
        <TodoExplorerDrawer items={todoItems} onClose={() => setTodoItems(null)} />
      )}
      <ToastStack toasts={toasts} />
    </>
  );
}
