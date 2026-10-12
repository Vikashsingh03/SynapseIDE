import { Lock, Users, Check } from 'lucide-react';
import { useFiles } from '../contexts/FileContext';
import { LANGUAGES, getLanguageByExtension } from '../utils/languageMap';

export default function StatusBar({ theme = 'dark', peersCount = 0, activeFileLock = null, currentUserId }) {
  const { activeFile } = useFiles();

  const currentLang = activeFile ? getLanguageByExtension(activeFile.name) : LANGUAGES[0];
  const isLockedByOther = Boolean(
    activeFileLock?.userId && activeFileLock.userId !== currentUserId
  );
  const lockLabel = activeFileLock
    ? isLockedByOther
      ? `Locked by ${activeFileLock.username || 'someone'}`
      : 'Edit lock held by you'
    : 'No file lock';

  // v3 signature: SOLID BLUE bar, mono white text — identical in both themes
  return (
    <footer className="h-8 bg-(--blue) flex items-center justify-between pl-2 pr-3 text-[11px] text-white font-mono relative z-60 shrink-0 select-none">
      <div className="flex items-center gap-1 h-full">
        <div className="flex items-center gap-1.5 px-2.5 h-full">
          <Lock size={10} className="opacity-80" />
          <span className="font-semibold tracking-wide">Secure Tunnel</span>
        </div>
        <div className="flex items-center gap-1.5 px-2.5 h-full">
          <Users size={10} className="opacity-80" />
          <span className="font-semibold tracking-wide tabular-nums">{peersCount} Peer{peersCount !== 1 ? 's' : ''} Online</span>
        </div>
        <div className="flex items-center gap-1.5 px-2.5 h-full">
          <Check size={10} className="opacity-80" />
          <span className="font-medium opacity-90">{lockLabel}</span>
        </div>
      </div>
      <div className="flex items-center gap-1 h-full">
        <span className="px-2.5 opacity-90">{currentLang.name} <span className="opacity-70">v{currentLang.version || '3.10'}</span></span>
        <span className="px-2.5 opacity-70 tabular-nums">Ln 1, Col 1</span>
        <div className="flex items-center gap-1.5 pl-2.5 pr-2 h-full">
          <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse-dot" />
          <span className="font-semibold uppercase tracking-[0.14em] text-[9px]">Live Sync Active</span>
        </div>
      </div>
    </footer>
  );
}
