import { useState } from 'react';
import { useFiles } from '../contexts/FileContext';
import { getLanguageByExtension } from '../utils/languageMap';
import { getThemeClasses } from '../utils/theme';
import {
  Terminal,
  SquareTerminal,
  AlertCircle,
  ChevronDown,
  Check,
  Zap,
  MemoryStick,
  CircleDashed,
  Sparkles,
} from 'lucide-react';
import TerminalPanel from './TerminalPanel';

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
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-(--acid) animate-pulse" />
            <span className="w-1.5 h-1.5 rounded-full bg-(--acid) animate-pulse" style={{ animationDelay: '150ms' }} />
            <span className="w-1.5 h-1.5 rounded-full bg-(--acid) animate-pulse" style={{ animationDelay: '300ms' }} />
          </span>
          <span className="text-sm font-medium font-mono text-[#8290a8]">Executing code…</span>
        </div>
      );
    }

    if (activeTab === 'output') {
      if (output?.error) {
        return (
          <pre className="leading-relaxed whitespace-pre-wrap animate-fade-in p-5 font-mono text-xs text-[#ff8a75]">
            {output.error}
          </pre>
        );
      }
      if (output?.status && output.status.id === 3) {
        return (
          <pre className="leading-relaxed whitespace-pre-wrap animate-fade-in p-5 font-mono text-xs text-[#dce5f3]">
            {output.stdout || <span className="text-[#8290a8]">Execution finished. No output.</span>}
          </pre>
        );
      }
      if (output?.stdout) {
         return (
          <pre className="leading-relaxed whitespace-pre-wrap animate-fade-in p-5 font-mono text-xs text-[#dce5f3]">
            {output.stdout}
          </pre>
        );
      }
      return (
        <div className="flex flex-col items-center justify-center gap-2 h-full min-h-30 text-[#8290a8] animate-fade-in">
          <CircleDashed size={22} className="opacity-40" />
          <span className="text-xs font-mono">Press <span className="font-bold">Ctrl+Enter</span> to run the code</span>
        </div>
      );
    }

    if (activeTab === 'errors') {
      const errorContent = output?.stderr || output?.compile_output;
      if (errorContent) {
        return (
          <pre className="leading-relaxed whitespace-pre-wrap animate-fade-in p-5 font-mono text-xs text-amber-400">
            {errorContent}
          </pre>
        );
      }
      return (
        <div className="flex items-center justify-center gap-2 h-full min-h-30 text-xs animate-fade-in">
          <span className="inline-flex items-center gap-2 text-[#8290a8] font-mono">
            <Check size={14} className="text-emerald-500" />
            Clean build. Zero issues found.
          </span>
        </div>
      );
    }
  };

  return (
    <div className={`border-t border-[#283348] flex flex-col transition-[height] duration-200 shrink-0 bg-[#121824] ${isOutputExpanded ? 'h-64' : 'h-10'}`}>
      {/* Header */}
      <div className="h-10 flex items-center justify-between pl-4 pr-2 border-b border-[#283348] bg-[#182131] shrink-0">
        <div className="flex gap-1 h-full items-end">
          {['output', 'errors', 'terminal'].map((tab) => {
            const isActive = activeTab === tab && isOutputExpanded;
            return (
              <button
                key={tab}
                onClick={() => { setActiveTab(tab); setIsOutputExpanded(true); }}
                className={`relative font-mono text-[10px] font-bold uppercase tracking-[0.16em] h-full px-3 flex items-center gap-1.5 transition-colors duration-150 cursor-pointer ${
                  isActive ? 'text-[#dce5f3]' : 'text-[#8290a8] hover:text-[#dce5f3]'
                }`}
              >
                {tab === 'output' ? <Terminal size={12} /> : tab === 'terminal' ? <SquareTerminal size={12} /> : <AlertCircle size={12} />}
                {tab}
                {tab === 'errors' && hasError && (
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                )}
                {isActive && (
                  <span className="absolute bottom-0 left-2 right-2 h-0.5 rounded-full bg-(--blue)" />
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
              className={`${t.btnAccent} px-2.5! py-1! text-[11px]!`}
            >
              <Sparkles size={11} />
              Explain with Neura
            </button>
          )}
          {output?.time && (
            <span className={`${t.chip} inline-flex items-center gap-1`}>
              <Zap size={10} className={t.textMuted} />
              {output.time}s
            </span>
          )}
          {output?.memory && (
            <span className={`${t.chip} inline-flex items-center gap-1`}>
              <MemoryStick size={10} className={t.textMuted} />
              {(output.memory / 1024).toFixed(1)}MB
            </span>
          )}
          <button
            onClick={() => setIsOutputExpanded(!isOutputExpanded)}
            className={`${t.iconBtn} p-1.5!`}
            title={isOutputExpanded ? 'Collapse' : 'Expand'}
          >
            <ChevronDown size={14} className={`transition-transform duration-200 ${isOutputExpanded ? '' : 'rotate-180'}`} />
          </button>
        </div>
      </div>

      {isOutputExpanded && activeTab === 'terminal' && (
        <div className="flex-1 min-h-0">
          <TerminalPanel />
        </div>
      )}
      {isOutputExpanded && activeTab !== 'terminal' && (
        <div className="flex-1 overflow-auto font-mono text-xs custom-scrollbar min-h-0">
          {displayContent()}
        </div>
      )}
    </div>
  );
}
