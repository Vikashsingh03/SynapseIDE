import { useState, useCallback, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useFiles } from '../contexts/FileContext';
import { executeCode } from '../services/api';
import { getThemeClasses } from '../utils/theme';
import { LANGUAGES, getLanguageByExtension } from '../utils/languageMap';
import { getAvatarColor, getAvatarStyle, getUserInitial } from '../utils/avatar';
import SynapseLogo from './SynapseLogo';
import NotificationBell from './NotificationBell';
import {
  LayoutGrid,
  Play,
  CloudUpload,
  Check,
  ChevronDown,
  Keyboard,
  X,
  Sun,
  Moon,
  Copy,
  Share2,
  LogOut,
  Command,
  ScanSearch
} from 'lucide-react';

export default function Toolbar({
  theme,
  onToggleTheme,
  setOutput,
  onSaveVersion,
  roomId,
  roomName,
  copied,
  onCopyInvite,
  onExitRoom,
  onExit,
  currentUser,
  onOpenPalette,
  onOpenReview
}) {
  const { activeFile, renameFile } = useFiles();
  const [isRunning, setIsRunning] = useState(false);
  const [isStdinOpen, setIsStdinOpen] = useState(false);
  const [stdinValue, setStdinValue] = useState('');
  const [saveStatus, setSaveStatus] = useState('idle');

  const t = getThemeClasses(theme);
  const currentLang = activeFile ? getLanguageByExtension(activeFile.name) : LANGUAGES[0];
  const showRoomControls = Boolean(roomId || onCopyInvite);
  const avatarColor = getAvatarColor(currentUser, currentUser?.cursorColor || currentUser?.avatarColor);
  const avatarStyle = getAvatarStyle(currentUser, avatarColor);
  const dark = theme === 'dark';

  const handleRun = useCallback(async () => {
    if (!activeFile || isRunning) return;

    setIsRunning(true);
    setOutput({
      stdout: '',
      stderr: '',
      compile_output: '',
      status: null,
      error: null,
      running: true,
    });

    try {
      const result = await executeCode(
        activeFile.content,
        currentLang.id,
        stdinValue
      );
      setOutput({
        ...result,
        error: null,
        running: false,
      });
    } catch (error) {
      setOutput({
        stdout: '',
        stderr: '',
        compile_output: '',
        status: { description: 'Error' },
        error: error.message,
        running: false,
      });
    } finally {
      setIsRunning(false);
    }
  }, [activeFile, currentLang, stdinValue, isRunning, setOutput]);

  // ── Tadka pack: command palette can trigger a run via CustomEvent ──
  useEffect(() => {
    const onRunEvent = () => handleRun();
    window.addEventListener('synapse:run-code', onRunEvent);
    return () => window.removeEventListener('synapse:run-code', onRunEvent);
  }, [handleRun]);

  // ── Tadka pack: Ctrl/Cmd + Enter runs code (from the editor, not from inputs) ──
  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        const inMonaco = e.target?.closest?.('.monaco-editor');
        const inField = e.target?.closest?.('input, textarea, [contenteditable="true"]');
        if (inMonaco || !inField) {
          e.preventDefault();
          handleRun();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleRun]);

  const handleSave = () => {
    if (onSaveVersion) {
      setSaveStatus('saving');
      onSaveVersion();
      setTimeout(() => setSaveStatus('saved'), 1500);
      setTimeout(() => setSaveStatus('idle'), 4000);
    }
  };

  // Paper-style cluster buttons (theme-aware via CSS vars)
  const clusterBtn = dark
    ? 'text-(--muted) hover:text-(--ink) hover:bg-white/6'
    : 'text-(--muted) hover:text-(--ink) hover:bg-black/5';

  return (
    <header className={`h-14 flex items-center justify-between pl-3 pr-4 ${t.header} relative z-50 shrink-0`}>
      {/* Left: brand + run controls */}
      <div className="flex items-center flex-1 min-w-0 gap-3">
        <div className="flex items-center shrink-0">
          <Link to="/" className="flex items-center gap-2.5">
            <span className="flex w-8 h-8 rounded-md bg-(--red) items-center justify-center">
              <SynapseLogo size={16} color="#ffffff" nodeColor="#ffffff" />
            </span>
            <span className={`font-bold tracking-tight text-[15px] ${t.textPrimary}`}>
              Synapse
            </span>
          </Link>
          <Link
            to="/dashboard"
            className={`hidden md:inline-flex ml-5 items-center gap-1.5 px-3 py-1.5 rounded-md border ${t.border} text-[11px] font-medium transition-colors ${clusterBtn}`}
          >
            <LayoutGrid size={12} />
            Dashboard
          </Link>
        </div>

        {/* Mobile RUN button — compact acid */}
        <button
          onClick={handleRun}
          disabled={isRunning || !activeFile}
          aria-label="Run code"
          className={`${t.btnRun} md:hidden disabled:opacity-50 disabled:pointer-events-none ml-1`}
        >
          {isRunning ? (
            <span className="w-3.5 h-3.5 border-2 rounded-full animate-spin border-[#10140b]/30 border-t-[#10140b]" />
          ) : (
            <Play size={12} className="fill-current" />
          )}
          <span>{isRunning ? 'RUN…' : 'RUN'}</span>
        </button>

        {/* Run control cluster — desktop */}
        <div className={`hidden md:flex items-center gap-1 p-1 rounded-lg border ${t.border}`}>
          {/* Run Button — acid lime, mono (v3 signature) */}
          <button
            onClick={handleRun}
            disabled={isRunning || !activeFile}
            className={`${t.btnRun} disabled:opacity-50 disabled:pointer-events-none`}
          >
            {isRunning ? (
              <span className="w-3.5 h-3.5 border-2 rounded-full animate-spin border-[#10140b]/30 border-t-[#10140b]" />
            ) : (
              <Play size={12} className="fill-current" />
            )}
            <span>{isRunning ? 'RUNNING…' : 'RUN'}</span>
          </button>

          {/* Save Version Button */}
          {onSaveVersion && (
            <button
              onClick={handleSave}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium cursor-pointer transition-colors ${clusterBtn}`}
            >
              {saveStatus === 'saving' ? (
                <span className={`w-3.5 h-3.5 border-2 rounded-full animate-spin ${dark ? 'border-zinc-500 border-t-zinc-200' : 'border-zinc-300 border-t-zinc-700'}`} />
              ) : saveStatus === 'saved' ? (
                <Check size={14} className="text-emerald-500" />
              ) : (
                <CloudUpload size={14} />
              )}
              <span className={saveStatus === 'saved' ? 'text-emerald-500' : ''}>
                {saveStatus === 'saving' ? 'Saving…' : saveStatus === 'saved' ? 'Saved' : 'Save'}
              </span>
            </button>
          )}

          {/* Language dropdown */}
          <div className="relative group">
            <button className={`flex items-center gap-1.5 pl-3 pr-2 py-1.5 rounded-md text-xs font-medium cursor-pointer transition-colors ${clusterBtn}`}>
              <span className="font-mono">{currentLang.name}</span>
              <ChevronDown size={12} className={t.textMuted} />
            </button>
            <div className={`${t.card} absolute top-full left-0 mt-2 w-44 p-1.5 opacity-0 invisible translate-y-1 group-hover:opacity-100 group-hover:visible group-hover:translate-y-0 transition-all duration-150 z-60`}>
              {LANGUAGES.map(lang => (
                <button
                  key={lang.id}
                  onClick={() => {
                    if (activeFile && lang.id !== currentLang.id) {
                      const lastDotIndex = activeFile.name.lastIndexOf('.');
                      const baseName = lastDotIndex > 0 ? activeFile.name.substring(0, lastDotIndex) : activeFile.name;
                      const newName = baseName + lang.extension;
                      renameFile(activeFile.id, newName);
                    }
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-xs cursor-pointer transition-colors ${
                    lang.id === currentLang.id
                      ? 'bg-(--blue)/10 text-(--blue)'
                      : clusterBtn
                  }`}
                >
                  <span className="font-mono">{lang.name}</span>
                  {lang.id === currentLang.id && <Check size={12} />}
                </button>
              ))}
            </div>
          </div>

          {/* Stdin Button */}
          <div className="relative">
            <button
              onClick={() => setIsStdinOpen(!isStdinOpen)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium cursor-pointer transition-colors border ${
                isStdinOpen
                  ? 'bg-(--blue)/10 text-(--blue) border-(--blue)/30'
                  : `border-transparent ${clusterBtn}`
              }`}
            >
              <Keyboard size={13} />
              <span className="font-mono">stdin</span>
            </button>

            {isStdinOpen && (
              <div className={`${t.card} absolute top-full left-0 mt-2 w-80 p-4 flex flex-col gap-3 animate-fade-in z-60`}>
                <div className="flex justify-between items-center">
                  <span className={t.eyebrow}>Standard Input</span>
                  <button onClick={() => setIsStdinOpen(false)} className={t.iconBtn + ' p-1!'} title="Close">
                    <X size={13} />
                  </button>
                </div>
                <textarea
                  autoFocus
                  value={stdinValue}
                  onChange={(e) => setStdinValue(e.target.value)}
                  placeholder="Enter program input here…"
                  className={`${t.input} w-full h-32 p-3 text-xs font-mono resize-none`}
                />
                {stdinValue && (
                  <p className={`text-[10px] ${t.textMuted}`}>Will be piped to your program on Run.</p>
                )}
              </div>
            )}
          </div>

          {/* Command palette trigger */}
          <button
            onClick={onOpenPalette}
            title="Command palette (Ctrl+K or Ctrl+Shift+P)"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium cursor-pointer transition-colors ${clusterBtn}`}
          >
            <Command size={13} />
            <span className={t.kbd}>Ctrl K</span>
          </button>

          {/* Neura code review trigger */}
          <button
            onClick={onOpenReview}
            title="Review code with Neura AI"
            className={`${t.btnSecondary} px-3! py-1.5! text-xs!`}
          >
            <ScanSearch size={13} />
            <span>Review</span>
          </button>
        </div>
      </div>

      {/* Right: theme, room, exit, avatar */}
      <div className="flex items-center gap-2 shrink-0">
        <NotificationBell theme={theme} />
        <button
          onClick={onToggleTheme}
          className={t.iconBtn}
          title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        >
          {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
        </button>

        {showRoomControls && (
          <div className={`hidden lg:flex items-center gap-2.5 pl-3.5 pr-2 py-1.5 rounded-lg border ${t.border}`}>
            <div className="flex flex-col items-start leading-tight">
              <span className={`text-[11px] font-semibold ${t.textPrimary} truncate max-w-37.5 tracking-wide`}>
                {roomName || 'Untitled Project'}
              </span>
              <span className={`text-[10px] ${t.textMuted} font-mono`}>
                ID: {roomId}
              </span>
            </div>
            <button
              onClick={onCopyInvite}
              className={`${t.iconBtn} p-1.5!`}
              title="Copy invite link"
            >
              {copied ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
            </button>
          </div>
        )}
        {showRoomControls && (
          <button
            onClick={onCopyInvite}
            className={`${t.btnSecondary} px-3! py-1.5! text-xs! hidden sm:inline-flex`}
          >
            <Share2 size={13} />
            Invite
          </button>
        )}
        {(showRoomControls || onExit) && (
          <button
            onClick={showRoomControls ? onExitRoom : onExit}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer border bg-(--red)/7 hover:bg-(--red)/[0.14] border-(--red)/25 text-(--red)"
            title="Exit session"
            type="button"
          >
            <LogOut size={13} />
            <span className="hidden sm:inline">Exit</span>
          </button>
        )}
        <div
          className={`w-8 h-8 rounded-full border ${t.border} flex items-center justify-center text-[11px] font-bold select-none cursor-default`}
          style={avatarStyle}
          title={currentUser?.username || currentUser?.name || 'You'}
        >
          {getUserInitial(currentUser)}
        </div>
      </div>
    </header>
  );
}
