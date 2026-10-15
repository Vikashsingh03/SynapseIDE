import { useState, useEffect, useMemo } from 'react';
import { X, Play, ListChecks, AlertTriangle, FileCode2, Check } from 'lucide-react';
import { useFiles } from '../contexts/FileContext';
import { findTasksFile, parseTasks, relPathOf } from '../utils/launchConfig';

const TASKS_EXAMPLE = `{
  // Synapse tasks — named terminal commands, like tasks.json in VS Code
  "tasks": [
    {
      "label": "Build",
      "command": "npm run build"
    },
    {
      "label": "Dev",
      "command": "npm run dev"
    }
  ]
}`;

function TasksPanel({ onClose }) {
  const { files, createFile, updateContent } = useFiles();
  const [copied, setCopied] = useState(false);

  const parsed = useMemo(() => {
    const file = findTasksFile(files);
    if (!file) return { state: 'missing', tasks: [], rel: null };
    const tasks = parseTasks(file.content || '');
    
    
    const looksEmpty = !(file.content || '').trim();
    if (tasks.length === 0 && !looksEmpty) {
      
      
      const trimmed = (file.content || '').trim();
      const startsJson = trimmed[0] === '{' || trimmed[0] === '[';
      if (startsJson) {
        try {
          JSON.parse(trimmed.replace(/,(?=\s*[}\]])/g, ''));
          return { state: 'empty', tasks: [], rel: relPathOf(file, files) };
        } catch {}
      }
      return { state: 'invalid', tasks: [], rel: relPathOf(file, files) };
    }
    return { state: tasks.length ? 'ok' : 'empty', tasks, rel: relPathOf(file, files) };
  }, [files]);

  const createTasksFile = () => {
    try {
      const id = createFile('tasks.json', null);
      if (id) updateContent(id, TASKS_EXAMPLE);
    } catch {}
  };

  const copyExample = async () => {
    try {
      await navigator.clipboard.writeText(TASKS_EXAMPLE);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  const runTask = (task) => {
    try {
      window.dispatchEvent(
        new CustomEvent('synapse:terminal-run', { detail: { command: task.command } })
      );
    } catch {}
    onClose?.();
  };

  return (
    <div className="fixed inset-y-0 right-0 w-[440px] max-w-[92vw] z-[70] bg-(--paper-2) border-l border-(--line) flex flex-col shadow-[0_0_48px_rgba(0,0,0,0.45)] animate-fade-in">
      { }
      <div className="px-4 py-3 flex items-center gap-2.5 shrink-0 border-b border-(--line)">
        <span className="w-8 h-8 rounded-md border border-(--line) flex items-center justify-center text-(--blue)">
          <ListChecks size={16} />
        </span>
        <div className="flex flex-col min-w-0">
          <span className="text-[13px] font-extrabold text-(--ink)">Tasks</span>
          <span className="font-mono text-[10px] text-(--muted)">named commands from tasks.json</span>
        </div>
        <button
          onClick={onClose}
          className="ml-auto p-1.5 rounded-md text-(--muted) hover:text-(--red) hover:bg-(--ink)/5 transition-colors cursor-pointer"
          title="Close"
        >
          <X size={16} />
        </button>
      </div>

      { }
      <div className="flex-1 overflow-y-auto custom-scrollbar px-4 py-4 flex flex-col gap-3">
        {parsed.state === 'ok' && (
          <>
            <p className="font-mono text-[10.5px] text-(--muted)">
              From <span className="text-(--blue)">{parsed.rel}</span> — {parsed.tasks.length} task
              {parsed.tasks.length > 1 ? 's' : ''}
            </p>
            {parsed.tasks.map((t) => (
              <div
                key={t.label}
                className="rounded-xl border border-(--line) bg-(--paper) p-3.5"
              >
                <div className="flex items-center gap-2.5">
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-extrabold text-(--ink) truncate">{t.label}</p>
                    <p
                      className="font-mono text-[11px] text-(--muted) truncate mt-0.5"
                      title={t.command}
                    >
                      {t.command}
                    </p>
                  </div>
                  <button
                    onClick={() => runTask(t)}
                    title={`Run "${t.label}" in the terminal`}
                    className="shrink-0 h-8 px-3 rounded-lg font-extrabold text-[12px] flex items-center gap-1.5 bg-(--ink) text-(--paper) hover:opacity-90 active:scale-[0.98] transition-all cursor-pointer"
                  >
                    <Play size={13} />
                    Run
                  </button>
                </div>
              </div>
            ))}
            <p className="font-mono text-[10.5px] text-(--muted) mt-auto pt-2">
              Commands run in the active terminal&apos;s workspace folder.
            </p>
          </>
        )}

        {(parsed.state === 'missing' || parsed.state === 'empty') && (
          <div className="flex flex-col items-center text-center gap-2.5 py-8">
            <FileCode2 size={28} className="text-(--muted)" />
            <p className="text-[13px] font-bold text-(--ink)">No tasks yet</p>
            <p className="font-mono text-[11px] text-(--muted) leading-relaxed">
              Create a <span className="text-(--blue)">tasks.json</span> at the project root — one
              named command per task.
            </p>
            <pre className="mt-2 w-full text-left font-mono text-[10.5px] leading-relaxed p-3 rounded-lg border border-(--line) bg-[#0A0E17] text-slate-300 overflow-x-auto custom-scrollbar">
              {TASKS_EXAMPLE}
            </pre>
            <div className="flex items-center gap-2 mt-1">
              <button
                onClick={createTasksFile}
                className="h-9 px-4 rounded-lg font-extrabold text-[12px] bg-(--ink) text-(--paper) hover:opacity-90 active:scale-[0.99] transition-all cursor-pointer"
              >
                Create tasks.json
              </button>
              <button
                onClick={copyExample}
                className="h-9 px-4 rounded-lg font-extrabold text-[12px] border border-(--line) text-(--ink) hover:border-(--blue)/50 transition-colors cursor-pointer flex items-center gap-1.5"
              >
                {copied ? <Check size={13} /> : null}
                {copied ? 'Copied' : 'Copy example'}
              </button>
            </div>
          </div>
        )}

        {parsed.state === 'invalid' && (
          <div className="flex flex-col items-center text-center gap-2.5 py-8">
            <AlertTriangle size={28} className="text-amber-400" />
            <p className="text-[13px] font-bold text-(--ink)">tasks.json could not be parsed</p>
            <p className="font-mono text-[11px] text-(--muted) leading-relaxed">
              <span className="text-(--blue)">{parsed.rel}</span> is not valid JSONC — check for a
              missing comma or an unclosed brace.
            </p>
            <pre className="mt-2 w-full text-left font-mono text-[10.5px] leading-relaxed p-3 rounded-lg border border-(--line) bg-[#0A0E17] text-slate-300 overflow-x-auto custom-scrollbar">
              {TASKS_EXAMPLE}
            </pre>
            <button
              onClick={copyExample}
              className="h-9 px-4 rounded-lg font-extrabold text-[12px] border border-(--line) text-(--ink) hover:border-(--blue)/50 transition-colors cursor-pointer flex items-center gap-1.5"
            >
              {copied ? <Check size={13} /> : null}
              {copied ? 'Copied' : 'Copy example'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export function TasksHost() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener('synapse:open-tasks', onOpen);
    return () => window.removeEventListener('synapse:open-tasks', onOpen);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  if (!open) return null;
  return <TasksPanel onClose={() => setOpen(false)} />;
}

export default TasksPanel;
