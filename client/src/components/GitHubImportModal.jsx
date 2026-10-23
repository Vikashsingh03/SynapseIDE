import { useEffect, useRef, useState } from 'react';
import { X, FolderDown, Loader2, Check, AlertTriangle } from 'lucide-react';
import { useFiles } from '../contexts/FileContext';
import { getThemeClasses } from '../utils/theme';
import { fetchGithubProject } from '../utils/githubImport';

function applyGithubProject(result, filesApi) {
  const folderIds = new Map([['', null]]);
  const skipped = [];
  let importedFolders = 0;

  for (const folderPath of result.folders) {
    const segments = folderPath.split('/');
    const name = segments[segments.length - 1];
    const parentPath = segments.slice(0, -1).join('/');
    const parentId = folderIds.has(parentPath) ? folderIds.get(parentPath) : null;
    try {
      const id = filesApi.createFolder(name, parentId);
      if (!id) throw new Error('Folder creation failed');
      folderIds.set(folderPath, id);
      importedFolders += 1;
    } catch {
      folderIds.set(folderPath, parentId);
      skipped.push({ path: folderPath, reason: 'create-error' });
    }
  }

  let importedFiles = 0;
  for (const file of result.files) {
    const segments = file.path.split('/');
    const name = segments[segments.length - 1];
    const parentPath = segments.slice(0, -1).join('/');
    const parentId = folderIds.has(parentPath) ? folderIds.get(parentPath) : null;
    try {
      const id = filesApi.createFile(name, parentId);
      if (!id) throw new Error('File creation failed');
      filesApi.updateContent(id, file.content);
      importedFiles += 1;
    } catch {
      skipped.push({ path: file.path, reason: 'create-error' });
    }
  }

  return { importedFiles, importedFolders, skipped };
}

function GitHubImportModal({ open, onClose, theme = 'dark' }) {
  const { createFile, createFolder, updateContent } = useFiles();
  const t = getThemeClasses(theme);
  const [url, setUrl] = useState('');
  const [status, setStatus] = useState('idle');
  const [progress, setProgress] = useState({ fetched: 0, total: 0 });
  const [error, setError] = useState('');
  const [summary, setSummary] = useState(null);
  const closeTimerRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    setUrl('');
    setStatus('idle');
    setProgress({ fetched: 0, total: 0 });
    setError('');
    setSummary(null);
  }, [open ]);

  useEffect(() => () => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
  }, []);

  const working = status === 'working';

  useEffect(() => {
    if (!open) return;
    const onKey = (event) => {
      if (event.key === 'Escape' && !working) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, working, onClose]);

  if (!open) return null;

  const startImport = async () => {
    if (working || !url.trim()) return;
    setStatus('working');
    setError('');
    setSummary(null);
    setProgress({ fetched: 0, total: 0 });
    try {
      const result = await fetchGithubProject(url, (fetched, total) => {
        setProgress({ fetched, total });
      });
      const applied = applyGithubProject(result, { createFile, createFolder, updateContent });
      setSummary({
        repoName: result.repoName,
        importedFiles: applied.importedFiles,
        importedFolders: applied.importedFolders,
        skipped: result.skipped.length + applied.skipped.length,
      });
      setStatus('done');
      closeTimerRef.current = setTimeout(() => onClose(), 2600);
    } catch (e) {
      setError(e.message || 'GitHub import fail ho gaya — dobara try karo.');
      setStatus('error');
    }
  };

  const percent = progress.total > 0 ? Math.round((progress.fetched / progress.total) * 100) : 0;

  return (
    <div className={t.modalOverlay} onClick={working ? undefined : onClose}>
      <div
        className={`${t.modalCard} w-[min(560px,94vw)] max-h-[86vh] flex flex-col`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={`flex items-center gap-3 px-5 py-4 border-b ${t.border} shrink-0`}>
          <span className="flex items-center justify-center w-9 h-9 rounded-md border bg-(--blue)/10 border-(--blue)/30">
            <FolderDown size={17} className="text-(--blue)" />
          </span>
          <div className="flex-1 min-w-0">
            <h2 className={`text-sm font-extrabold ${t.textPrimary}`}>Import from GitHub</h2>
            <p className={`text-xs ${t.textMuted} truncate`}>
              Bring a public GitHub repo straight into this workspace.
            </p>
          </div>
          <button onClick={onClose} disabled={working} className={`${t.iconBtn} disabled:opacity-50`} title="Close">
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 custom-scrollbar min-h-0">
          <label className={`${t.eyebrow} block mb-1.5`}>GitHub repo link</label>
          <div className="flex items-center gap-2">
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') startImport();
              }}
              placeholder="https://github.com/owner/repo"
              className={`${t.input} flex-1`}
              disabled={working}
              autoFocus
            />
            <button
              onClick={startImport}
              disabled={working || !url.trim()}
              className={`${t.btnPrimary} disabled:opacity-50 shrink-0`}
            >
              {working ? <Loader2 size={14} className="animate-spin" /> : <FolderDown size={14} />}
              {working ? 'Importing…' : 'Import'}
            </button>
          </div>
          <p className={`text-[12px] ${t.textMuted} mt-2.5 leading-relaxed`}>
            The repo&apos;s files will be added to your current workspace — exactly like a ZIP
            import. Your existing files stay untouched. Only public repos work, and very large
            files, binaries and folders like node_modules or dist are skipped.
          </p>

          {working && (
            <div className="mt-5 animate-fade-in">
              <div className="flex items-center gap-2.5">
                <Loader2 size={16} className="animate-spin text-(--blue)" />
                <p className={`text-[13px] font-mono ${t.textMuted}`}>
                  {progress.total > 0
                    ? `Fetching files… ${progress.fetched} of ${progress.total}`
                    : 'Reading the repo from GitHub…'}
                </p>
              </div>
              {progress.total > 0 && (
                <div className="mt-3 h-1.5 rounded-full bg-(--ink)/10 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-(--blue) transition-[width] duration-300"
                    style={{ width: `${percent}%` }}
                  />
                </div>
              )}
            </div>
          )}

          {status === 'error' && error && (
            <div className="mt-5 rounded-lg border border-(--red)/30 bg-(--red)/10 px-4 py-3 flex items-start gap-2.5 animate-fade-in">
              <AlertTriangle size={15} className="text-(--red) shrink-0 mt-px" />
              <p className="text-[13px] text-(--red) leading-relaxed">{error}</p>
            </div>
          )}

          {status === 'done' && summary && (
            <div className="mt-5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 animate-fade-in">
              <p className="flex items-center gap-1.5 text-[13px] font-bold text-emerald-500">
                <Check size={14} /> Imported from {summary.repoName}
              </p>
              <p className={`text-[12px] ${t.textMuted} mt-1`}>
                {summary.importedFiles} file{summary.importedFiles === 1 ? '' : 's'}
                {summary.importedFolders
                  ? ` · ${summary.importedFolders} folder${summary.importedFolders === 1 ? '' : 's'}`
                  : ''}
                {summary.skipped ? ` · skipped ${summary.skipped}` : ''}
              </p>
            </div>
          )}
        </div>

        <div className={`flex items-center justify-between gap-3 px-5 py-3.5 border-t ${t.border} shrink-0`}>
          <p className={`text-[11px] ${t.textMuted} hidden sm:block`}>
            Public repos only · Powered by the GitHub API
          </p>
          <div className="flex items-center gap-2 ml-auto">
            <button onClick={onClose} disabled={working} className={`${t.btnSecondary} disabled:opacity-50`}>
              {status === 'done' ? 'Done' : 'Cancel'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function GitHubImportHost({ theme = 'dark' }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener('synapse:import-github', onOpen);
    return () => window.removeEventListener('synapse:import-github', onOpen);
  }, []);
  if (!open) return null;
  return <GitHubImportModal open={open} onClose={() => setOpen(false)} theme={theme} />;
}
