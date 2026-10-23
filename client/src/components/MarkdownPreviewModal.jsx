import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { X, FileText, FileWarning } from 'lucide-react';
import { useFiles } from '../contexts/FileContext';
import { getThemeClasses } from '../utils/theme';
import { isMarkdownFile, markdownFileTitle } from '../utils/markdownPreview';

const MD_PREVIEW_CLASSES = [
  'text-[13.5px] leading-relaxed text-(--muted)',
  '[&_h1]:text-[24px] [&_h1]:font-extrabold [&_h1]:text-(--ink) [&_h1]:mb-3 [&_h1]:mt-1',
  '[&_h2]:text-[18px] [&_h2]:font-bold [&_h2]:text-(--ink) [&_h2]:mt-6 [&_h2]:mb-2',
  '[&_h3]:text-[15px] [&_h3]:font-bold [&_h3]:text-(--ink) [&_h3]:mt-5 [&_h3]:mb-1.5',
  '[&_h4]:text-[13.5px] [&_h4]:font-bold [&_h4]:text-(--ink) [&_h4]:mt-4 [&_h4]:mb-1',
  '[&_p]:mb-3',
  '[&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-3',
  '[&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:mb-3',
  '[&_li]:mb-0.5',
  '[&_input]:mr-1.5',
  '[&_code]:font-mono [&_code]:text-[12px] [&_code]:bg-(--ink)/8 [&_code]:px-1 [&_code]:py-px [&_code]:rounded',
  '[&_pre]:bg-black/30 [&_pre]:border [&_pre]:border-(--line) [&_pre]:p-3.5 [&_pre]:rounded-lg [&_pre]:overflow-x-auto [&_pre]:my-3',
  '[&_pre_code]:bg-transparent [&_pre_code]:p-0',
  '[&_a]:text-(--blue) [&_a]:underline',
  '[&_blockquote]:border-l-2 [&_blockquote]:border-(--line) [&_blockquote]:pl-3 [&_blockquote]:italic [&_blockquote]:my-3',
  '[&_hr]:my-4 [&_hr]:border-(--line)',
  '[&_strong]:text-(--ink)',
  '[&_table]:w-full [&_table]:border-collapse [&_table]:my-3 [&_table]:text-[12.5px]',
  '[&_th]:border [&_th]:border-(--line) [&_th]:px-2.5 [&_th]:py-1.5 [&_th]:text-left [&_th]:text-(--ink)',
  '[&_td]:border [&_td]:border-(--line) [&_td]:px-2.5 [&_td]:py-1.5',
  '[&_img]:max-w-full [&_img]:rounded-lg [&_img]:my-2',
].join(' ');

function MarkdownPreviewModal({ theme = 'dark', onClose }) {
  const t = getThemeClasses(theme);
  const { activeFile } = useFiles();

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const file = activeFile && activeFile.type !== 'folder' ? activeFile : null;
  const isMd = file ? isMarkdownFile(file.name) : false;
  const content = file && typeof file.content === 'string' ? file.content : '';
  const hasContent = content.trim().length > 0;

  const emptyMessage = file
    ? `The active file "${file.name}" is not a Markdown file. Switch to a .md or .markdown file, then open the preview again.`
    : 'No file is currently open. Open a .md or .markdown file first, then open the preview again.';

  return (
    <div className={t.modalOverlay} onClick={onClose}>
      <div
        className={`${t.modalCard} w-[min(820px,94vw)] max-h-[88vh] flex flex-col`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={`flex items-center gap-3 px-5 py-4 border-b ${t.border} shrink-0`}>
          <span className="flex items-center justify-center w-9 h-9 rounded-md border bg-(--blue)/10 border-(--blue)/30">
            <FileText size={17} className="text-(--blue)" />
          </span>
          <div className="flex-1 min-w-0">
            <h2 className={`text-sm font-extrabold ${t.textPrimary} truncate`}>
              {markdownFileTitle(file?.name)}
            </h2>
            <p className={`text-xs ${t.textMuted} truncate`}>
              {isMd ? 'Markdown preview — updates live as you type' : 'Markdown preview'}
            </p>
          </div>
          <button onClick={onClose} className={t.iconBtn} title="Close">
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 custom-scrollbar min-h-0">
          {isMd && hasContent && (
            <div className={MD_PREVIEW_CLASSES}>
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
            </div>
          )}
          {isMd && !hasContent && (
            <div className="flex flex-col items-center gap-3 py-12 animate-fade-in">
              <span className="w-10 h-10 rounded-md border border-(--line) flex items-center justify-center">
                <FileText size={18} className="text-(--muted)" />
              </span>
              <p className={`text-sm ${t.textMuted} text-center max-w-sm`}>
                This file is empty. Start typing Markdown in the editor and the preview will
                update here live.
              </p>
            </div>
          )}
          {!isMd && (
            <div className="flex flex-col items-center gap-3 py-12 animate-fade-in">
              <span className="w-10 h-10 rounded-md border border-(--line) flex items-center justify-center">
                <FileWarning size={18} className="text-amber-500" />
              </span>
              <p className={`text-sm font-bold ${t.textPrimary}`}>Open a .md file first</p>
              <p className={`text-sm ${t.textMuted} text-center max-w-sm`}>{emptyMessage}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function MarkdownPreviewHost({ theme = 'dark' }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener('synapse:open-md-preview', onOpen);
    return () => window.removeEventListener('synapse:open-md-preview', onOpen);
  }, []);
  if (!open) return null;
  return <MarkdownPreviewModal theme={theme} onClose={() => setOpen(false)} />;
}
