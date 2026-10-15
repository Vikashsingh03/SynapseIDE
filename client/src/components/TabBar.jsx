import { useState, useLayoutEffect, useRef } from 'react';
import { useFiles } from '../contexts/FileContext';
import { copyText } from '../utils/clipboard';
import { X, ChevronRight, Lock, Copy, Check, Download, Columns2 } from 'lucide-react';
import FileIcon from './FileIcon';

export default function TabBar({ theme, roomId = 'Room', fileLocks = {}, currentUserId, showSplit = false, splitActive = false }) {
  const { files, openTabs, activeFileId, openTab, closeTab } = useFiles();
  const [copied, setCopied] = useState(false);

  
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

  
  
  return (
    <>
      {
}
      <div
        className="relative flex items-stretch bg-[#0B0F16] border-b border-white/8 h-9 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden shrink-0 select-none"
        role="tablist"
        aria-label="Open files"
      >
        {tabFiles.map((file) => {
          const isActive = file.id === activeFileId;
          const fileLock = fileLocks[file.id];
          const isLockedByOther = Boolean(fileLock?.userId && fileLock.userId !== currentUserId);
          return (
            <div
              key={file.id}
              role="tab"
              aria-selected={isActive}
              ref={(el) => {
                if (el) tabEls.current.set(file.id, el);
                else tabEls.current.delete(file.id);
              }}
              onClick={() => openTab(file.id)}
              onMouseDown={(e) => {
                
                if (e.button === 1) e.preventDefault();
              }}
              onAuxClick={(e) => {
                if (e.button === 1) {
                  e.stopPropagation();
                  closeTab(file.id);
                }
              }}
              className={`relative flex items-center gap-2 px-3 text-[12.5px] font-medium cursor-pointer min-w-33 max-w-50 shrink-0 border-r border-white/6 transition-colors group ${
                isActive
                  ? 'bg-[#121824] text-[#EAF1FB] border-r-transparent'
                  : 'text-[#8B98AC] hover:bg-white/[0.04] hover:text-[#C9D4E6]'
              }`}
            >
              <FileIcon name={file.name} size={15} />
              <span className="truncate">{file.name}</span>
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
                className={`ml-auto shrink-0 p-0.5 rounded text-[#8B98AC] hover:text-[#EAF1FB] hover:bg-white/10 transition-all cursor-pointer ${
                  isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                }`}
                title="Close tab"
                aria-label={`Close ${file.name}`}
              >
                <X size={12} />
              </button>
            </div>
          );
        })}
        { }
        <span
          aria-hidden="true"
          className="tab-indicator pointer-events-none absolute top-0 left-0 h-[2px] bg-[#58A6FF] shadow-[0_0_8px_#58A6FF66]"
          style={{
            width: indicator.width,
            transform: `translateX(${indicator.left}px)`,
            opacity: indicator.visible ? 1 : 0,
          }}
        />
      </div>

      { }
      <div className="flex items-center gap-1.5 px-4 py-2 text-[11px] text-[#8290a8] bg-[#121824] border-b border-[#2b3546] shrink-0 font-mono">
        <span className="font-medium tracking-wide">{roomId}</span>

        { }
        <span className="ml-auto flex items-center gap-0.5">
          {showSplit && (
            <button
              onClick={() => window.dispatchEvent(new Event('synapse:toggle-split'))}
              className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                splitActive
                  ? 'text-[#58A6FF] bg-white/8'
                  : 'text-[#8290a8] hover:text-[#dce5f3] hover:bg-white/6'
              }`}
              title="Split editor"
              aria-label="Toggle split editor"
            >
              <Columns2 size={13} />
            </button>
          )}
          {activeFile && (
            <>
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
            </>
          )}
        </span>
      </div>
    </>
  );
}
