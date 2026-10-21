import { useState, useEffect } from 'react';
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
  GitBranch,
  Lightbulb,
  Wand2,
} from 'lucide-react';
import TerminalPanel from './TerminalPanel';
import GitPanel from './GitPanel';
import ProblemsPanel from './ProblemsPanel';
import { getRunErrorText, buildExplainPrompt, buildRunFixDetail } from '../utils/runError';

export default function OutputPanel({ theme, output, roomId }) {
  const [activeTab, setActiveTab] = useState('output');
  const [isOutputExpanded, setIsOutputExpanded] = useState(true);
  const { activeFile } = useFiles();

  
  useEffect(() => {
    const openProblems = () => {
      setActiveTab('errors');
      setIsOutputExpanded(true);
    };
    window.addEventListener('synapse:open-problems', openProblems);
    return () => window.removeEventListener('synapse:open-problems', openProblems);
  }, []);

  const t = getThemeClasses(theme);

  const hasError = output?.stderr || output?.compile_output || output?.error;
  const isRunning = output?.running;

   
  const runError = !isRunning ? getRunErrorText(output) : null;

  const handleSamjhao = () => {
    if (!runError) return;
    const lang = getLanguageByExtension(activeFile?.name || '');
    const prompt = buildExplainPrompt({
      fileName: activeFile?.name || '',
      language: lang.name,
      errorText: runError.text,
      parsed: runError.parsed,
      fileContent: activeFile?.content || '',
    });
    window.dispatchEvent(new CustomEvent('synapse:ask-neura', { detail: { prompt } }));
  };

  const handleFixRunError = () => {
    if (!runError || !activeFile) return;
    const detail = buildRunFixDetail({ outputText: runError.text, file: activeFile });
    if (!detail) return;
    window.dispatchEvent(new CustomEvent('synapse:neura-fix', { detail }));
  };

  
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
      return (
        <div className="flex flex-col h-full min-h-30">
          {errorContent ? (
            <pre className="leading-relaxed whitespace-pre-wrap animate-fade-in p-5 pb-2 font-mono text-xs text-amber-400 shrink-0 max-h-32 overflow-auto">
              {errorContent}
            </pre>
          ) : null}
          <div className="flex-1 min-h-0">
            <ProblemsPanel />
          </div>
        </div>
      );
    }
  };

  const panelHeight = !isOutputExpanded ? 'h-10' : activeTab === 'git' ? 'h-[420px]' : 'h-64';
  return (
    <div className={`border-t border-white/[0.07] flex flex-col transition-[height] duration-200 shrink-0 bg-[#121824] shadow-[inset_0_1px_10px_rgba(0,0,0,0.28)] ${panelHeight}`}>
      { }
      <div className="h-[34px] flex items-center justify-between pl-4 pr-2 border-b border-white/[0.06] bg-[#0B0F16] shrink-0">
        <div className="flex gap-1 h-full items-end">
          {['output', 'errors', 'terminal', 'git'].map((tab) => {
            const isActive = activeTab === tab && isOutputExpanded;
            return (
              <button
                key={tab}
                onClick={() => { setActiveTab(tab); setIsOutputExpanded(true); }}
                className={`relative text-[11px] font-semibold uppercase tracking-[0.08em] h-full px-3.5 flex items-center gap-1.5 transition-colors duration-150 cursor-pointer ${
                  isActive ? 'text-[#EAF1FB]' : 'text-[#7E8CA3] hover:text-[#C7D3E8]'
                }`}
              >
                {tab === 'output' ? <Terminal size={12} /> : tab === 'terminal' ? <SquareTerminal size={12} /> : tab === 'git' ? <GitBranch size={12} /> : <AlertCircle size={12} />}
                {tab}
                {tab === 'errors' && hasError && (
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.9)]" />
                )}
                {isActive && (
                  <span className="absolute bottom-0 left-2.5 right-2.5 h-[2px] rounded-full bg-[#58A6FF] shadow-[0_0_10px_rgba(88,166,255,0.8)]" />
                )}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-2 text-[11px] font-mono">
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
            className="p-1 rounded text-[#8B98AC] hover:text-white hover:bg-white/5 transition-colors"
            title={isOutputExpanded ? 'Collapse' : 'Expand'}
          >
            <ChevronDown size={14} className={`transition-transform duration-200 ${isOutputExpanded ? '' : 'rotate-180'}`} />
          </button>
        </div>
      </div>

      {isOutputExpanded && activeTab === 'terminal' && (
        <div className="flex-1 min-h-0">
          <TerminalPanel roomId={roomId} />
        </div>
      )}
      {isOutputExpanded && activeTab === 'git' && (
        <div className="flex-1 min-h-0">
          <GitPanel theme={theme} roomId={roomId} />
        </div>
      )}
      {isOutputExpanded && activeTab !== 'terminal' && activeTab !== 'git' && (
        <div className="flex-1 overflow-auto font-mono text-[12.5px] leading-relaxed custom-scrollbar min-h-0">
          {runError && (
            <div className="sticky top-0 z-10 flex items-center gap-2 px-4 py-2 border-b border-red-400/15 bg-[#1a141c]">
              <AlertCircle size={13} className="text-red-300 shrink-0" />
              <span className="text-[11px] font-mono text-red-200/80 truncate flex-1" title={runError.parsed.message}>
                {runError.parsed.message}
              </span>
              <button
                onClick={handleSamjhao}
                title="Neura is error ko simple Hindi-English mein samjhayegi"
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold border border-white/10 text-[#C7D3E8] hover:bg-white/5 transition-colors cursor-pointer shrink-0"
              >
                <Lightbulb size={11} />
                Samjhao
              </button>
              <button
                onClick={handleFixRunError}
                disabled={!activeFile}
                title="Neura se is error ka fix karwao"
                className={`${t.btnAccent} px-2.5! py-1! text-[11px]! shrink-0 disabled:opacity-40`}
              >
                <Wand2 size={11} />
                Fix with Neura
              </button>
            </div>
          )}
          {displayContent()}
        </div>
      )}
    </div>
  );
}
