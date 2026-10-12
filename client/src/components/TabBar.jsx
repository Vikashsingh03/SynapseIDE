import { useState, useLayoutEffect, useRef } from 'react';
import { useFiles } from '../contexts/FileContext';
import { copyText } from '../utils/clipboard';
import { X, FileCode2, ChevronRight, Lock, Copy, Check, Download } from 'lucide-react';

export default function TabBar({ theme, roomId = 'Room', fileLocks = {}, currentUserId }) {
  const { files, openTabs, activeFileId, openTab, closeTab } = useFiles();
  const [copied, setCopied] = useState(false);

  // ── Sliding active-tab indicator (measured, transform-only) ──
  const tabEls = useRef(new Map());
  const [indicator, setIndicator] = useState({ left: 0, width: 0, visible: false });

  useLayoutEffect(() => {
    const el = tabEls.current.get(activeFileId);
    if (el) {
      setIndicator({ left: el.offsetLeft, width: el.offsetWidth, visible: true });
    } else {
      setIndicator((prev) => ({ ...prev, visible: false }));
    }
  }, [activeFileId, openTabs]);

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

  // Tabs sit inside the ALWAYS-DARK IDE frame → use the IDE palette
  // (code text #dce5f3, comments #8290a8) regardless of page theme.
  return (
    <>
      {/* Tabs — text with 2px blue accent underline for active */}
      <div className="relative flex items-stretch bg-[#121824] border-b border-[#2b3546] min-h-10 overflow-x-auto scrollbar-hide shrink-0 px-2 gap-1">
        {tabFiles.map((file) => {
          const isActive = file.id === activeFileId;
          const fileLock = fileLocks[file.id];
          const isLockedByOther = Boolean(fileLock?.userId && fileLock.userId !== currentUserId);
          return (
            <div
              key={file.id}
              ref={(el) => {
                if (el) tabEls.current.set(file.id, el);
                else tabEls.current.delete(file.id);
              }}
              onClick={() => openTab(file.id)}
              className={`relative flex items-center gap-2 px-3 text-xs cursor-pointer min-w-33 max-w-50 select-none transition-colors group border-b-2 border-transparent -mb-px font-mono ${
                isActive ? 'text-[#dce5f3]' : 'text-[#8290a8] hover:text-[#dce5f3]'
              }`}
            >
              <FileCode2 size={13} className={`shrink-0 ${isActive ? 'text-(--blue)' : ''}`} />
              <span className="truncate font-medium">{file.name}</span>
              {fileLock && (
                <span
                  className={`inline-flex items-center shrink-0 ${isLockedByOther ? 'text-amber-500' : 'text-emerald-500'}`}
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
                className="ml-auto shrink-0 p-0.5 rounded opacity-0 group-hover:opacity-100 text-[#8290a8] hover:text-[#dce5f3] transition-colors cursor-pointer"
                title="Close tab"
              >
                <X size={12} />
              </button>
            </div>
          );
        })}
        {/* Sliding active-tab indicator (transform-only, 60fps) */}
        <span
          aria-hidden="true"
          className="tab-indicator pointer-events-none absolute bottom-0 left-0 h-0.5 bg-(--blue)"
          style={{
            width: indicator.width,
            transform: `translateX(${indicator.left}px)`,
            opacity: indicator.visible ? 1 : 0,
          }}
        />
      </div>

      {/* Breadcrumbs — IDE chrome */}
      <div className="flex items-center gap-1.5 px-4 py-2 text-[11px] text-[#8290a8] bg-[#121824] border-b border-[#2b3546] shrink-0 font-mono">
        <span className="cursor-pointer transition-colors font-medium hover:text-[#70a5ff]">{roomId}</span>
        <ChevronRight size={11} className="opacity-50" />
        <span className="cursor-pointer transition-colors font-medium hover:text-[#70a5ff]">src</span>
        {activeFile && (
          <>
            <ChevronRight size={11} className="opacity-50" />
            <span className="text-[#dce5f3] font-semibold">{activeFile.name}</span>
          </>
        )}

        {/* Quick actions: copy + download active file */}
        {activeFile && (
          <span className="ml-auto flex items-center gap-0.5">
            <button
              onClick={handleCopyCode}
              className="p-1.5 rounded-md text-[#8290a8] hover:text-[#dce5f3] hover:bg-white/6 transition-colors cursor-pointer"
              title="Copy file code"
            >
              {copied ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
            </button>
            <button
              onClick={handleDownload}
              className="p-1.5 rounded-md text-[#8290a8] hover:text-[#dce5f3] hover:bg-white/6 transition-colors cursor-pointer"
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
