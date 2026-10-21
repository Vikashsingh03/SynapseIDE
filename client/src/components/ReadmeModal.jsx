import { useEffect, useMemo, useState } from 'react';
import {
  X,
  BookOpen,
  Sparkles,
  Loader2,
  RotateCcw,
  Copy,
  Check,
  Save,
  FileWarning,
} from 'lucide-react';
import { useFiles } from '../contexts/FileContext';
import { getThemeClasses } from '../utils/theme';
import { API_BASE } from '../config/apiConfig';
import { getToken } from '../services/authService';
import { copyText } from '../utils/clipboard';
import { renderMarkdown } from '../utils/miniMarkdown';
import { collectProjectSummary, cleanReadmeMarkdown } from '../utils/readmeGen';

const PREVIEW_CLASSES = [
  'text-[13px] leading-relaxed text-(--muted)',
  '[&_h1]:text-[22px] [&_h1]:font-extrabold [&_h1]:text-(--ink) [&_h1]:mb-2',
  '[&_h2]:text-[16px] [&_h2]:font-bold [&_h2]:text-(--ink) [&_h2]:mt-5 [&_h2]:mb-2',
  '[&_h3]:text-[14px] [&_h3]:font-bold [&_h3]:text-(--ink) [&_h3]:mt-4 [&_h3]:mb-1.5',
  '[&_p]:mb-2.5',
  '[&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-2.5',
  '[&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:mb-2.5',
  '[&_li]:mb-0.5',
  '[&_code]:font-mono [&_code]:text-[12px] [&_code]:bg-(--ink)/8 [&_code]:px-1 [&_code]:py-px [&_code]:rounded',
  '[&_pre]:bg-black/30 [&_pre]:border [&_pre]:border-(--line) [&_pre]:p-3.5 [&_pre]:rounded-lg [&_pre]:overflow-x-auto [&_pre]:my-3',
  '[&_pre_code]:bg-transparent [&_pre_code]:p-0',
  '[&_a]:text-(--blue) [&_a]:underline',
  '[&_blockquote]:border-l-2 [&_blockquote]:border-(--line) [&_blockquote]:pl-3 [&_blockquote]:italic [&_blockquote]:my-3',
  '[&_hr]:my-4 [&_hr]:border-(--line)',
  '[&_strong]:text-(--ink)',
].join(' ');

function prefillFrom(summary) {
  let name = 'My Project';
  let tagline = '';
  if (summary.existingReadme) {
    const lines = summary.existingReadme.split('\n');
    const h1 = lines.find((l) => l.startsWith('# '));
    if (h1 && h1.slice(2).trim()) name = h1.slice(2).trim();
    const tag = lines.find((l) => l.trim() && !l.trim().startsWith('#'));
    if (tag && tag.trim().length <= 120) tagline = tag.trim();
  }
  if (name === 'My Project' && summary.clientPkg && summary.clientPkg.name) {
    name = summary.clientPkg.name;
  }
  return { name, tagline };
}

export default function ReadmeModal({ open, onClose, theme = 'dark' }) {
  const { files, createFile, updateContent } = useFiles();
  const t = getThemeClasses(theme);
  const [projectName, setProjectName] = useState('My Project');
  const [tagline, setTagline] = useState('');
  const [status, setStatus] = useState('idle');
  const [markdown, setMarkdown] = useState('');
  const [error, setError] = useState('');
  const [showRaw, setShowRaw] = useState(false);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);

  const summary = useMemo(() => collectProjectSummary(files), [files]);
  const hasFiles = useMemo(() => files.some((f) => f && f.type !== 'folder'), [files]);

  useEffect(() => {
    if (!open) return;
    const p = prefillFrom(collectProjectSummary(files));
    setProjectName(p.name);
    setTagline(p.tagline);
    setStatus('idle');
    setMarkdown('');
    setError('');
    setShowRaw(false);
    setSaved(false);
    setCopied(false);
  }, [open ]);

  if (!open) return null;

  const generate = async () => {
    if (status === 'loading' || !hasFiles) return;
    setStatus('loading');
    setError('');
    setSaved(false);
    try {
      const token = getToken();
      const res = await fetch(`${API_BASE}/ai/readme`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          projectName: projectName.trim() || 'My Project',
          tagline: tagline.trim(),
          summary: {
            tree: summary.tree,
            clientPkg: summary.clientPkg,
            serverPkg: summary.serverPkg,
            existingReadme: summary.existingReadme,
          },
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'README generation failed.');
      }
      const cleaned = cleanReadmeMarkdown(data.markdown || '', projectName.trim() || 'My Project');
      if (!cleaned) {
        throw new Error('Neura returned an empty README. Please try again.');
      }
      setMarkdown(cleaned);
      setShowRaw(false);
      setStatus('done');
    } catch (e) {
      setError(e.message || 'README generation failed. Please try again.');
      setStatus('error');
    }
  };

  const save = () => {
    if (!markdown || status === 'loading') return;
    try {
      if (summary.readmeFileId) {
        updateContent(summary.readmeFileId, markdown);
      } else {
        const id = createFile('README.md', null);
        updateContent(id, markdown);
      }
      setSaved(true);
    } catch (e) {
      setError(e.message || 'Could not save the README.');
    }
  };

  const copy = async () => {
    if (!markdown) return;
    const ok = await copyText(markdown);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  const busy = status === 'loading';

  return (
    <div className={t.modalOverlay} onClick={onClose}>
      <div
        className={`${t.modalCard} w-[min(760px,94vw)] max-h-[86vh] flex flex-col`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={`flex items-center gap-3 px-5 py-4 border-b ${t.border} shrink-0`}>
          <span className="flex items-center justify-center w-9 h-9 rounded-md border bg-(--blue)/10 border-(--blue)/30">
            <BookOpen size={17} className="text-(--blue)" />
          </span>
          <div className="flex-1 min-w-0">
            <h2 className={`text-sm font-extrabold ${t.textPrimary}`}>Generate README with Neura</h2>
            <p className={`text-xs ${t.textMuted} truncate`}>
              Neura writes a README.md from this project&apos;s files — nothing is saved until you click Save.
            </p>
          </div>
          <button onClick={onClose} className={t.iconBtn} title="Close">
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 custom-scrollbar min-h-0">
          <div className="grid gap-3 sm:grid-cols-[1fr_1.4fr]">
            <div>
              <label className={`${t.eyebrow} block mb-1.5`}>Project name</label>
              <input
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="My Project"
                className={t.input}
                disabled={busy}
              />
            </div>
            <div>
              <label className={`${t.eyebrow} block mb-1.5`}>Tagline (optional)</label>
              <input
                value={tagline}
                onChange={(e) => setTagline(e.target.value)}
                placeholder="One line that says what it does"
                className={t.input}
                disabled={busy}
              />
            </div>
          </div>

          {!hasFiles && (
            <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3">
              <p className="text-[13px] text-amber-500">
                This project has no files yet. Add a file or create a project from a template first, then generate a README.
              </p>
            </div>
          )}

          {error && !(status === 'error' && !markdown) && (
            <div className="mt-4 rounded-lg border border-(--red)/30 bg-(--red)/10 px-4 py-3">
              <p className="text-[13px] text-(--red)">{error}</p>
            </div>
          )}

          {status === 'loading' && (
            <div className="flex flex-col items-center gap-4 py-12 animate-fade-in">
              <Loader2 size={28} className="animate-spin text-(--blue)" />
              <p className={`text-sm font-mono ${t.textMuted}`}>
                Neura is reading your project and writing the README…
              </p>
            </div>
          )}

          {status === 'error' && !markdown && (
            <div className="flex flex-col items-center gap-3 py-10 animate-fade-in">
              <span className="w-10 h-10 rounded-md border border-(--line) flex items-center justify-center">
                <FileWarning size={18} className="text-amber-500" />
              </span>
              <p className={`text-sm ${t.textMuted} text-center max-w-sm`}>{error}</p>
              <button onClick={generate} className={t.btnSecondary}>
                <RotateCcw size={14} /> Try again
              </button>
            </div>
          )}

          {status === 'idle' && !markdown && hasFiles && (
            <p className={`text-[13px] ${t.textMuted} mt-5 leading-relaxed`}>
              Neura will look at your file tree
              {summary.clientPkg || summary.serverPkg ? ', package.json details' : ''}
              {summary.existingReadme ? ' and your existing README' : ''} and draft a professional
              README. You can preview it, copy it, or save it as the project&apos;s root README.md.
            </p>
          )}

          {markdown && status !== 'loading' && (
            <div className="mt-5 animate-fade-in">
              <div className="flex items-center gap-2 mb-2">
                <span className={`${t.eyebrow} flex-1`}>Preview</span>
                <button
                  onClick={() => setShowRaw(false)}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-bold border transition-colors cursor-pointer ${
                    !showRaw
                      ? 'bg-(--blue)/10 border-(--blue)/30 text-(--blue)'
                      : 'border-(--line) text-(--muted) hover:text-(--ink)'
                  }`}
                >
                  Rendered
                </button>
                <button
                  onClick={() => setShowRaw(true)}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-bold border transition-colors cursor-pointer ${
                    showRaw
                      ? 'bg-(--blue)/10 border-(--blue)/30 text-(--blue)'
                      : 'border-(--line) text-(--muted) hover:text-(--ink)'
                  }`}
                >
                  Raw
                </button>
              </div>
              <div className="rounded-lg border border-(--line) bg-(--paper) p-4 max-h-[38vh] overflow-y-auto custom-scrollbar">
                {showRaw ? (
                  <pre className={`font-mono text-[12px] leading-relaxed whitespace-pre-wrap ${t.textMuted}`}>
                    {markdown}
                  </pre>
                ) : (
                  <div
                    className={PREVIEW_CLASSES}
                    dangerouslySetInnerHTML={{ __html: renderMarkdown(markdown) }}
                  />
                )}
              </div>
              {saved && (
                <p className="flex items-center gap-1.5 mt-3 text-[13px] font-bold text-emerald-500">
                  <Check size={14} /> Saved to README.md at the project root.
                </p>
              )}
            </div>
          )}
        </div>

        <div className={`flex items-center justify-between gap-3 px-5 py-3.5 border-t ${t.border} shrink-0`}>
          <p className={`text-[11px] ${t.textMuted} hidden sm:block`}>
            Powered by Neura AI · Review before you share it
          </p>
          <div className="flex items-center gap-2 ml-auto">
            {markdown ? (
              <>
                <button onClick={copy} className={t.btnSecondary}>
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                  {copied ? 'Copied!' : 'Copy'}
                </button>
                <button onClick={generate} disabled={busy} className={`${t.btnSecondary} disabled:opacity-50`}>
                  <RotateCcw size={14} /> Regenerate
                </button>
                <button onClick={save} disabled={busy} className={`${t.btnPrimary} disabled:opacity-50`}>
                  {saved ? <Check size={14} /> : <Save size={14} />}
                  {summary.readmeFileId ? 'Replace README.md' : 'Save as README.md'}
                </button>
              </>
            ) : (
              <button
                onClick={generate}
                disabled={busy || !hasFiles}
                className={`${t.btnPrimary} disabled:opacity-50`}
              >
                {busy ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                {busy ? 'Generating…' : 'Generate'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function ReadmeHost({ theme = 'dark' }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener('synapse:generate-readme', onOpen);
    return () => window.removeEventListener('synapse:generate-readme', onOpen);
  }, []);
  if (!open) return null;
  return <ReadmeModal open={open} onClose={() => setOpen(false)} theme={theme} />;
}
