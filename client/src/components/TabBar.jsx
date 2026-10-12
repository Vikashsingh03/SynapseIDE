import { useState } from 'react';
import { useFiles } from '../contexts/FileContext';
import { copyText } from '../utils/clipboard';
import { getThemeClasses } from '../utils/theme';
import { X, FileCode2, ChevronRight, Lock, Copy, Check, Download } from 'lucide-react';

export default function TabBar({ theme, roomId = 'Room', fileLocks = {}, currentUserId }) {
  const { files, openTabs, activeFileId, openTab, closeTab } = useFiles();
  const t = getThemeClasses(theme);
  const [copied, setCopied] = useState(false);

  const tabFiles = openTabs
    .map(id => files.find(f => f.id === id))
    .filter(Boolean);

  const activeFile = files.find(f => f.id === activeFileId);

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

  return (
    <>
      {/* Tabs */}
      <div className={`flex items-end ${t.header} border-b ${t.border} min-h-10 overflow-x-auto scrollbar-hide shrink-0 px-1.5 pt-1.5 gap-0.5`}>
        {tabFiles.map((file, i) => {
          const isActive = file.id === activeFileId;
          const fileLock = fileLocks[file.id];
          const isLockedByOther = Boolean(fileLock?.userId && fileLock.userId !== currentUserId);
          return (
            <div
              key={file.id}
              onClick={() => openTab(file.id)}
              style={{ animationDelay: `${i * 40}ms` }}
              className={`animate-fade-in relative flex items-center gap-2 pl-3.5 pr-2.5 py-2 text-xs rounded-t-xl cursor-pointer min-w-33 max-w-50 select-none transition-all duration-200 group border border-b-0 ${
                isActive
                  ? theme === 'dark'
                    ? 'bg-white/6 border-white/9 text-white shadow-[0_-8px_20px_-12px_rgba(139,92,246,0.4)]'
                    : 'bg-white border-slate-200 text-slate-900 shadow-sm'
                  : `border-transparent ${t.textMuted} hover:text-slate-200 ${theme === 'dark' ? 'hover:bg-white/4' : 'hover:bg-slate-100'}`
              }`}
            >
              {/* Active gradient underline */}
              {isActive && (
                <span className="absolute bottom-0 left-3 right-3 h-0.5 rounded-full bg-linear-to-r from-violet-500 via-indigo-400 to-cyan-400 shadow-[0_0_10px_rgba(139,92,246,0.8)]" />
              )}
              <FileCode2 size={13} className={`shrink-0 ${isActive ? 'text-violet-400' : t.textMuted}`} />
              <span className="truncate font-medium">{file.name}</span>
              {fileLock && (
                <span
                  className={`inline-flex items-center shrink-0 ${isLockedByOther ? 'text-amber-400' : 'text-emerald-400'}`}
                  title={isLockedByOther ? `${fileLock.username || 'Someone'} is editing` : 'You hold the lock'}
                >
                  <Lock size={10} />
                </span>
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  closeTab(file.id);
                }}
                className={`ml-auto shrink-0 p-0.5 rounded opacity-0 group-hover:opacity-100 ${t.textMuted} hover:text-rose-400 hover:bg-white/10 transition-all cursor-pointer`}
                title="Close tab"
              >
                <X size={12} />
              </button>
            </div>
          );
        })}
      </div>

      {/* Breadcrumbs */}
      <div className={`flex items-center gap-1.5 px-4 py-2 text-[11px] ${t.textMuted} ${t.editorBg} border-b ${t.border} shrink-0`}>
        <span className="hover:text-violet-400 cursor-pointer transition-colors font-medium">{roomId}</span>
        <ChevronRight size={11} className="opacity-50" />
        <span className="hover:text-violet-400 cursor-pointer transition-colors font-medium">src</span>
        {activeFile && (
          <>
            <ChevronRight size={11} className="opacity-50" />
            <span className="syn-text-gradient font-semibold font-mono">{activeFile.name}</span>
          </>
        )}

        {/* Quick actions: copy + download active file */}
        {activeFile && (
          <span className="ml-auto flex items-center gap-0.5">
            <button
              onClick={handleCopyCode}
              className={t.iconBtn + ' p-1.5!'}
              title="Copy file code"
            >
              {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
            </button>
            <button
              onClick={handleDownload}
              className={t.iconBtn + ' p-1.5!'}
              title={`Download ${activeFile.name}`}
            >
              <Download size={13} />
            </button>
          </span>
        )}
      </div>
    </>
  );
}
