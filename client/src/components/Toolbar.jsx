import { useState, useCallback, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useFiles } from '../contexts/FileContext';
import { executeCode } from '../services/api';
import { getThemeClasses } from '../utils/theme';
import { LANGUAGES, getLanguageByExtension } from '../utils/languageMap';
import { getAvatarColor, getAvatarStyle, getUserInitial } from '../utils/avatar';
import SynapseLogo from './SynapseLogo';
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

  return (
    <header className={`h-14 border-b ${t.border} flex items-center justify-between pl-3 pr-4 ${t.header} relative z-50 shrink-0`}>
      {/* Left: brand + run controls */}
      <div className="flex items-center flex-1 min-w-0 gap-3">
        <div className="flex items-center shrink-0">
          <Link to="/" className="flex items-center gap-2.5 group">
            <span className="flex w-8 h-8 rounded-xl bg-linear-to-br from-violet-500 via-indigo-500 to-cyan-500 items-center justify-center shadow-[0_0_20px_rgba(139,92,246,0.45)] group-hover:shadow-[0_0_28px_rgba(139,92,246,0.65)] group-hover:scale-105 transition-all duration-200">
              <SynapseLogo size={16} color="#ffffff" nodeColor="#ffffff" />
            </span>
            <span className={`font-display font-bold uppercase tracking-tight text-[15px] ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
              Synapse
            </span>
          </Link>
          <Link
            to="/dashboard"
            className={`hidden md:inline-flex ml-5 items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[11px] font-medium transition-all duration-200 hover:-translate-y-px ${theme === 'dark' ? 'bg-white/4 hover:bg-white/8 text-slate-300 border-white/10' : 'bg-slate-100 hover:bg-slate-200 text-slate-600 border-slate-200'}`}
          >
            <LayoutGrid size={12} />
            Dashboard
          </Link>
        </div>

        {/* Run control cluster */}
        <div className={`hidden md:flex items-center gap-1.5 p-1 rounded-xl border ${theme === 'dark' ? 'bg-white/3 border-white/[0.07]' : 'bg-slate-100/70 border-slate-200'}`}>
          {/* Run Button */}
          <button
            onClick={handleRun}
            disabled={isRunning || !activeFile}
            className="group flex items-center gap-2 pl-3 pr-4 py-1.5 rounded-lg text-xs font-semibold text-white bg-linear-to-br from-emerald-500 to-teal-600 shadow-[0_6px_20px_-4px_rgba(16,185,129,0.6)] hover:shadow-[0_8px_28px_-4px_rgba(16,185,129,0.8)] hover:-translate-y-px active:translate-y-0 active:scale-[0.97] transition-all duration-200 cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
          >
            {isRunning ? (
              <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
            ) : (
              <Play size={13} className="fill-white group-hover:scale-125 transition-transform" />
            )}
            <span>{isRunning ? 'Running…' : 'Run'}</span>
          </button>

          {/* Save Version Button */}
          {onSaveVersion && (
            <button
              onClick={handleSave}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-all duration-200 hover:-translate-y-px active:translate-y-0 ${theme === 'dark' ? 'text-slate-300 hover:bg-white/[0.07]' : 'text-slate-600 hover:bg-white'}`}
            >
              {saveStatus === 'saving' ? (
                <span className="w-3.5 h-3.5 border-2 border-violet-400/40 border-t-violet-400 rounded-full animate-spin" />
              ) : saveStatus === 'saved' ? (
                <Check size={14} className="text-emerald-400" />
              ) : (
                <CloudUpload size={14} className="text-violet-400" />
              )}
              <span className={saveStatus === 'saved' ? 'text-emerald-400' : ''}>
                {saveStatus === 'saving' ? 'Saving…' : saveStatus === 'saved' ? 'Saved' : 'Save'}
              </span>
            </button>
          )}

          {/* Language dropdown */}
          <div className="relative group">
            <button className={`flex items-center gap-1.5 pl-3 pr-2 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-all duration-200 ${theme === 'dark' ? 'text-slate-300 hover:bg-white/[0.07]' : 'text-slate-600 hover:bg-white'}`}>
              <span className="font-mono">{currentLang.name}</span>
              <ChevronDown size={12} className={`${t.textMuted} group-hover:rotate-180 transition-transform duration-200`} />
            </button>
            <div className="absolute top-full left-0 mt-2 w-44 syn-glass-strong rounded-xl p-1.5 shadow-2xl opacity-0 invisible translate-y-1 group-hover:opacity-100 group-hover:visible group-hover:translate-y-0 transition-all duration-200 z-60">
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
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs cursor-pointer transition-colors duration-150 ${lang.id === currentLang.id ? 'bg-violet-500/15 text-violet-300' : theme === 'dark' ? 'text-slate-300 hover:bg-white/6' : 'text-slate-600 hover:bg-slate-100'}`}
                >
                  <span className="font-mono">{lang.name}</span>
                  {lang.id === currentLang.id && <Check size={12} className="text-violet-400" />}
                </button>
              ))}
            </div>
          </div>

          {/* Stdin Button */}
          <div className="relative">
            <button
              onClick={() => setIsStdinOpen(!isStdinOpen)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-all duration-200 ${isStdinOpen ? 'bg-violet-500/15 text-violet-300 border border-violet-500/30' : theme === 'dark' ? 'text-slate-300 hover:bg-white/[0.07] border border-transparent' : 'text-slate-600 hover:bg-white border border-transparent'}`}
            >
              <Keyboard size={13} />
              <span className="font-mono">stdin</span>
            </button>

            {isStdinOpen && (
              <div className="absolute top-full left-0 mt-2 w-80 syn-glass-strong rounded-2xl shadow-2xl p-4 flex flex-col gap-3 animate-scale-in z-60">
                <div className={`flex justify-between items-center text-[10px] font-bold ${t.textMuted} uppercase tracking-[0.14em]`}>
                  Standard Input
                  <button onClick={() => setIsStdinOpen(false)} className={t.iconBtn + ' p-1!'} title="Close">
                    <X size={13} />
                  </button>
                </div>
                <textarea
                  autoFocus
                  value={stdinValue}
                  onChange={(e) => setStdinValue(e.target.value)}
                  placeholder="Enter program input here…"
                  className={`${t.input} w-full h-32 p-3 text-xs font-mono resize-none syn-focus-ring`}
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
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-all duration-200 hover:-translate-y-px active:translate-y-0 ${theme === 'dark' ? 'text-slate-300 hover:bg-white/[0.07]' : 'text-slate-600 hover:bg-white'}`}
          >
            <Command size={13} className="text-violet-400" />
            <span className={t.kbd}>Ctrl K</span>
          </button>

          {/* Neura code review trigger */}
          <button
            onClick={onOpenReview}
            title="Review code with Neura AI"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-all duration-200 hover:-translate-y-px active:translate-y-0 ${theme === 'dark' ? 'text-slate-300 hover:bg-white/[0.07]' : 'text-slate-600 hover:bg-white'}`}
          >
            <ScanSearch size={13} className="text-cyan-400" />
            <span>Review</span>
          </button>
        </div>
      </div>

      {/* Right: theme, room, exit, avatar */}
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={onToggleTheme}
          className={t.iconBtn}
          title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        >
          {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
        </button>

        {showRoomControls && (
          <div className={`hidden lg:flex items-center gap-2.5 pl-3.5 pr-2 py-1.5 rounded-xl border ${theme === 'dark' ? 'bg-white/3 border-white/8' : 'bg-slate-100 border-slate-200'}`}>
            <div className="flex flex-col items-start leading-tight">
              <span className={`text-[11px] font-bold ${t.textPrimary} truncate max-w-37.5 tracking-wide`}>
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
              {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
            </button>
          </div>
        )}
        {showRoomControls && (
          <button
            onClick={onCopyInvite}
            className="hidden sm:inline-flex items-center gap-1.5 pl-3 pr-4 py-2 rounded-xl text-xs font-semibold text-white bg-linear-to-br from-violet-500 to-indigo-600 shadow-[0_6px_20px_-4px_rgba(139,92,246,0.6)] hover:shadow-[0_8px_28px_-4px_rgba(139,92,246,0.8)] hover:-translate-y-px active:translate-y-0 active:scale-[0.97] transition-all duration-200 cursor-pointer"
          >
            <Share2 size={13} />
            Invite
          </button>
        )}
        {(showRoomControls || onExit) && (
          <button
            onClick={showRoomControls ? onExitRoom : onExit}
            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all duration-200 cursor-pointer hover:-translate-y-px active:translate-y-0 border ${theme === 'dark' ? 'bg-red-500/10 hover:bg-red-500/20 border-red-500/25 text-red-300' : 'bg-red-50 hover:bg-red-100 border-red-200 text-red-600'}`}
            title="Exit session"
            type="button"
          >
            <LogOut size={13} />
            <span className="hidden sm:inline">Exit</span>
          </button>
        )}
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold ring-2 ring-violet-500/30 select-none cursor-default hover:ring-violet-500/60 hover:scale-105 transition-all duration-200"
          style={avatarStyle}
          title={currentUser?.username || currentUser?.name || 'You'}
        >
          {getUserInitial(currentUser)}
        </div>
      </div>
    </header>
  );
}
