import { useState } from 'react';
import { useFiles } from '../contexts/FileContext';
import { getLanguageByExtension } from '../utils/languageMap';
import { getThemeClasses } from '../utils/theme';
import {
  Terminal,
  AlertCircle,
  ChevronDown,
  Check,
  Loader2,
  Zap,
  MemoryStick,
  CircleDashed,
  Sparkles,
} from 'lucide-react';

export default function OutputPanel({ theme, output }) {
  const [activeTab, setActiveTab] = useState('output');
  const [isOutputExpanded, setIsOutputExpanded] = useState(true);
  const { activeFile } = useFiles();

  const t = getThemeClasses(theme);

  const hasError = output?.stderr || output?.compile_output || output?.error;
  const isRunning = output?.running;

  /** Sends the current error to Neura AI for a plain-words explanation. */
  const handleExplainError = () => {
    const errorText = output?.stderr || output?.compile_output || output?.error || '';
    if (!errorText) return;
    const lang = getLanguageByExtension(activeFile?.name || '');
    const prompt = [
      'My ' + lang.name + ' program failed with this error:',
      '',
      errorText,
      '',
      'Here is the code' + (activeFile?.name ? ' from ' + activeFile.name : '') + ':',
      '```',
      activeFile?.content || '',
      '```',
      '',
      'Explain in simple words what went wrong and show me exactly how to fix it.',
    ].join('\n');
    window.dispatchEvent(new CustomEvent('synapse:ask-neura', { detail: { prompt } }));
  };

  // The output terminal contents
  const displayContent = () => {
    if (isRunning) {
      return (
        <div className="flex items-center gap-3 p-5 animate-fade-in">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-60" />
            <span className="relative inline-flex rounded-full h-3 w-3 bg-violet-500" />
          </span>
          <span className="text-sm font-medium text-violet-300">Executing code…</span>
          <span className="flex gap-1 ml-1">
            <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-typing" />
            <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-typing" style={{ animationDelay: '150ms' }} />
            <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-typing" style={{ animationDelay: '300ms' }} />
          </span>
        </div>
      );
    }

    if (activeTab === 'output') {
      if (output?.error) {
        return (
          <pre className="text-rose-400 leading-relaxed whitespace-pre-wrap animate-fade-in p-5">
            {output.error}
          </pre>
        );
      }
      if (output?.status && output.status.id === 3) {
        return (
          <pre className={`leading-relaxed whitespace-pre-wrap animate-fade-in p-5 ${theme === 'dark' ? 'text-slate-200' : 'text-slate-800'}`}>
            {output.stdout || <span className={`${t.textMuted} italic`}>Execution finished. No output.</span>}
          </pre>
        );
      }
      if (output?.stdout) {
         return (
          <pre className={`leading-relaxed whitespace-pre-wrap animate-fade-in p-5 ${theme === 'dark' ? 'text-slate-200' : 'text-slate-800'}`}>
            {output.stdout}
          </pre>
        );
      }
      return (
        <div className={`flex flex-col items-center justify-center gap-2 h-full min-h-30 ${t.textMuted} animate-fade-in`}>
          <CircleDashed size={22} className="opacity-40" />
          <span className="italic text-xs">Hit <span className="not-italic font-semibold text-emerald-400 font-mono">Run</span> to see output here…</span>
        </div>
      );
    }

    if (activeTab === 'errors') {
      const errorContent = output?.stderr || output?.compile_output;
      if (errorContent) {
        return (
          <pre className="text-amber-400/90 leading-relaxed whitespace-pre-wrap animate-fade-in p-5">
            {errorContent}
          </pre>
        );
      }
      return (
        <div className="flex items-center justify-center gap-2 h-full min-h-30 text-xs italic animate-fade-in">
          <span className={`inline-flex items-center gap-2 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
            <Check size={14} className="text-emerald-400 not-italic" />
            Clean build. Zero issues found.
          </span>
        </div>
      );
    }
  };

  return (
    <div className={`border-t ${t.border} flex flex-col transition-all duration-300 ease-in-out shrink-0 ${theme === 'dark' ? 'bg-[#07070f]/90' : 'bg-slate-50'} ${isOutputExpanded ? 'h-64' : 'h-10'}`}>
      {/* Header */}
      <div className={`h-10 flex items-center justify-between pl-4 pr-2 border-b ${t.border} shrink-0 ${theme === 'dark' ? 'bg-white/2' : 'bg-slate-100/60'}`}>
        <div className="flex gap-1 h-full items-end">
          {['output', 'errors'].map((tab) => {
            const isActive = activeTab === tab && isOutputExpanded;
            return (
              <button
                key={tab}
                onClick={() => { setActiveTab(tab); setIsOutputExpanded(true); }}
                className={`relative text-[10px] font-bold uppercase tracking-[0.16em] h-full px-3 flex items-center gap-1.5 transition-all duration-200 cursor-pointer ${
                  isActive ? 'text-violet-400' : `${t.textMuted} hover:text-slate-300`
                }`}
              >
                {tab === 'output' ? <Terminal size={12} /> : <AlertCircle size={12} />}
                {tab}
                {tab === 'errors' && hasError && (
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.9)] animate-pulse" />
                )}
                {isActive && (
                  <span className="absolute bottom-0 left-2 right-2 h-0.5 rounded-full bg-linear-to-r from-violet-500 to-cyan-400" />
                )}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-2 text-[11px] font-mono">
          {hasError && !isRunning && (
            <button
              onClick={handleExplainError}
              title="Ask Neura AI to explain this error"
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-sans font-semibold bg-linear-to-r from-violet-500/20 to-cyan-500/20 border border-violet-500/30 text-violet-300 hover:from-violet-500/35 hover:to-cyan-500/35 hover:-translate-y-px transition-all duration-200 cursor-pointer"
            >
              <Sparkles size={11} />
              Explain with Neura
            </button>
          )}
          {output?.time && (
            <span className={`${t.chip} inline-flex items-center gap-1`}>
              <Zap size={10} className="text-amber-400" />
              {output.time}s
            </span>
          )}
          {output?.memory && (
            <span className={`${t.chip} inline-flex items-center gap-1`}>
              <MemoryStick size={10} className="text-cyan-400" />
              {(output.memory / 1024).toFixed(1)}MB
            </span>
          )}
          <button
            onClick={() => setIsOutputExpanded(!isOutputExpanded)}
            className={`${t.iconBtn} p-1.5!`}
            title={isOutputExpanded ? 'Collapse' : 'Expand'}
          >
            <ChevronDown size={14} className={`transition-transform duration-300 ${isOutputExpanded ? '' : 'rotate-180'}`} />
          </button>
        </div>
      </div>

      {isOutputExpanded && (
        <div className="flex-1 overflow-auto font-mono text-xs custom-scrollbar min-h-0">
          {displayContent()}
        </div>
      )}
    </div>
  );
}
