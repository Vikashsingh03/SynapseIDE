import { Lock, Users, Check, Radio } from 'lucide-react';
import { useFiles } from '../contexts/FileContext';
import { LANGUAGES, getLanguageByExtension } from '../utils/languageMap';

export default function StatusBar({ peersCount = 0, activeFileLock = null, currentUserId }) {
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

  return (
    <footer className="h-8 bg-linear-to-r from-indigo-700 via-violet-700 to-indigo-700 bg-size-200%_100% animate-gradient-pan flex items-center justify-between pl-2 pr-3 text-[11px] text-white font-medium shadow-[0_-4px_24px_rgba(99,102,241,0.35)] relative z-60 shrink-0 select-none">
      <div className="flex items-center gap-1 h-full">
        <div className="flex items-center gap-1.5 hover:bg-white/10 px-2.5 h-full cursor-pointer transition-colors rounded-sm">
          <Lock size={10} className="opacity-80" />
          <span className="font-semibold tracking-wide">Secure Tunnel</span>
        </div>
        <div className="flex items-center gap-1.5 hover:bg-white/10 px-2.5 h-full cursor-pointer transition-colors rounded-sm">
          <Users size={10} className="opacity-80" />
          <span className="font-semibold tracking-wide tabular-nums">{peersCount} Peer{peersCount !== 1 ? 's' : ''} Online</span>
        </div>
        <div className="flex items-center gap-1.5 hover:bg-white/10 px-2.5 h-full cursor-pointer transition-colors rounded-sm">
          <Check size={10} className="opacity-80" />
          <span className="font-medium opacity-90">{lockLabel}</span>
        </div>
      </div>
      <div className="flex items-center gap-1 h-full">
        <span className="font-mono px-2.5 opacity-90">{currentLang.name} <span className="opacity-70">v{currentLang.version || '3.10'}</span></span>
        <span className="font-mono px-2.5 opacity-70 tabular-nums">Ln 1, Col 1</span>
        <div className="flex items-center gap-1.5 pl-2.5 pr-3 h-5.5 my-auto bg-emerald-400/15 border border-emerald-300/25 rounded-full backdrop-blur-sm">
          <span className="relative flex h-1.5 w-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-300 opacity-75" />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-300" />
          </span>
          <Radio size={10} className="text-emerald-200" />
          <span className="font-bold uppercase tracking-[0.14em] text-[9px] text-emerald-100">Live Sync Active</span>
        </div>
      </div>
    </footer>
  );
}
