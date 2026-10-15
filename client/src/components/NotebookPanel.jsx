








import { useCallback, useEffect, useRef, useState } from 'react';
import {
  NotebookPen,
  Play,
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  X,
  Check,
  Loader2,
} from 'lucide-react';
import { useFiles } from '../contexts/FileContext';
import { executeCode } from '../services/api';
import { renderMarkdown } from '../utils/miniMarkdown';

const LANG_IDS = { python: 71, javascript: 63 };

function freshNotebook(language = 'python') {
  return { language, cells: [{ type: 'code', source: '', output: '', error: false }] };
}

function safeParse(content) {
  if (content == null) return { ok: false, loading: true };
  try {
    const nb = JSON.parse(String(content));
    if (!nb || typeof nb !== 'object' || !Array.isArray(nb.cells)) {
      return { ok: false, corrupted: true };
    }
    return { ok: true, nb };
  } catch {
    return { ok: false, corrupted: true };
  }
}

function MarkdownView({ source }) {
  return (
    <div
      className="cursor-text text-[13px] leading-relaxed text-slate-300
        [&_h1]:text-xl [&_h1]:font-bold [&_h1]:text-slate-100 [&_h1]:mb-2
        [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-slate-100 [&_h2]:mb-1.5
        [&_h3]:text-[15px] [&_h3]:font-semibold [&_h3]:text-slate-200 [&_h3]:mb-1
        [&_p]:mb-2 [&_p:last-child]:mb-0
        [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-2
        [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:mb-2
        [&_li]:mb-0.5
        [&_code]:bg-white/10 [&_code]:px-1 [&_code]:py-px [&_code]:rounded [&_code]:font-mono [&_code]:text-[12px] [&_code]:text-amber-200
        [&_pre]:bg-black/40 [&_pre]:p-3 [&_pre]:rounded-lg [&_pre]:overflow-x-auto [&_pre]:mb-2
        [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_pre_code]:text-slate-200
        [&_blockquote]:border-l-2 [&_blockquote]:border-[#58A6FF]/50 [&_blockquote]:pl-3 [&_blockquote]:italic [&_blockquote]:text-slate-400 [&_blockquote]:mb-2
        [&_a]:text-[#58A6FF] [&_a]:underline [&_hr]:border-white/10 [&_hr]:my-3
        [&_strong]:text-slate-100"
      dangerouslySetInnerHTML={{ __html: renderMarkdown(source || '_Empty markdown cell — click to edit_') }}
    />
  );
}

function AddCellBar({ onAddCode, onAddMd }) {
  return (
    <div className="flex items-center justify-center gap-2 py-1.5 opacity-0 hover:opacity-100 transition-opacity group/add">
      <button
        onClick={onAddCode}
        className="text-[11px] px-2.5 py-1 rounded border border-dashed border-white/15 text-slate-400 hover:text-slate-200 hover:border-[#58A6FF]/50 hover:bg-[#58A6FF]/10 transition-colors"
      >
        + Code
      </button>
      <button
        onClick={onAddMd}
        className="text-[11px] px-2.5 py-1 rounded border border-dashed border-white/15 text-slate-400 hover:text-slate-200 hover:border-[#58A6FF]/50 hover:bg-[#58A6FF]/10 transition-colors"
      >
        + Markdown
      </button>
    </div>
  );
}

export default function NotebookPanel({ onClose }) {
  const { files, createFile, updateContent } = useFiles();

  const notebooks = files.filter((f) => f.type !== 'folder' && f.name.endsWith('.nb'));
  const [selectedId, setSelectedId] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [createName, setCreateName] = useState('notebook');
  const [createLang, setCreateLang] = useState('python');
  const [running, setRunning] = useState(new Set());
  const [runningAll, setRunningAll] = useState(false);
  const [editingMd, setEditingMd] = useState(null);

  const file = notebooks.find((n) => n.id === selectedId) || null;
  const fileRef = useRef(file);
  fileRef.current = file;

  
  useEffect(() => {
    if (!notebooks.find((n) => n.id === selectedId)) {
      setSelectedId(notebooks.length ? notebooks[0].id : null);
      setShowCreate(false);
    }
  }, [notebooks, selectedId]);

  
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const persist = useCallback(
    (fileId, nb) => updateContent(fileId, JSON.stringify(nb, null, 2)),
    [updateContent]
  );

  
  
  const mutateCells = useCallback(
    (fn) => {
      const f = fileRef.current;
      if (!f) return null;
      const parsed = safeParse(f.content);
      if (!parsed.ok) return null;
      const nb = { ...parsed.nb, cells: parsed.nb.cells.map((c) => ({ ...c })) };
      fn(nb);
      persist(f.id, nb);
      return nb;
    },
    [persist]
  );

  
  const handleCreate = () => {
    const base = (createName || 'notebook').trim() || 'notebook';
    const name = base.endsWith('.nb') ? base : `${base}.nb`;
    const id = createFile(name);
    persist(id, freshNotebook(createLang));
    setSelectedId(id);
    setShowCreate(false);
    setCreateName('notebook');
  };

  const handleReset = () => {
    if (!file) return;
    persist(file.id, freshNotebook(fileLanguage));
  };

  
  const updateCellSource = (i, source) =>
    mutateCells((nb) => {
      nb.cells[i] = { ...nb.cells[i], source };
    });

  const updateCell = (i, patch) =>
    mutateCells((nb) => {
      nb.cells[i] = { ...nb.cells[i], ...patch };
    });

  const addCell = (index, type) =>
    mutateCells((nb) => {
      nb.cells.splice(index, 0, { type, source: '', output: '', error: false });
    });

  const deleteCell = (i) =>
    mutateCells((nb) => {
      nb.cells.splice(i, 1);
    });

  const moveCell = (i, dir) =>
    mutateCells((nb) => {
      const j = i + dir;
      if (j < 0 || j >= nb.cells.length) return;
      const [cell] = nb.cells.splice(i, 1);
      nb.cells.splice(j, 0, cell);
    });

  const clearOutput = (i) => updateCell(i, { output: '', error: false });

  
  
  
  
  const runCell = useCallback(
    async (i) => {
      const f = fileRef.current;
      if (!f || running.has(i)) return;
      const parsed = safeParse(f.content);
      if (!parsed.ok) return;
      const cell = parsed.nb.cells[i];
      if (!cell || cell.type !== 'code') return;

      setRunning((prev) => new Set(prev).add(i));
      try {
        const langId = LANG_IDS[parsed.nb.language] ?? 71;
        const result = await executeCode(cell.source, langId, '');
        const errText = result?.stderr || result?.compile_output || result?.error || '';
        const out = result?.stdout && result.stdout.trim() ? result.stdout : errText || '(no output)';
        const fresh = fileRef.current;
        const freshParsed = safeParse(fresh?.content);
        if (freshParsed.ok && freshParsed.nb.cells[i]) {
          freshParsed.nb.cells[i] = { ...freshParsed.nb.cells[i], output: out, error: !!errText };
          persist(fresh.id, freshParsed.nb);
        }
      } catch (e) {
        const fresh = fileRef.current;
        const freshParsed = safeParse(fresh?.content);
        if (freshParsed.ok && freshParsed.nb.cells[i]) {
          freshParsed.nb.cells[i] = {
            ...freshParsed.nb.cells[i],
            output: e?.message || 'Run failed',
            error: true,
          };
          persist(fresh.id, freshParsed.nb);
        }
      } finally {
        setRunning((prev) => {
          const next = new Set(prev);
          next.delete(i);
          return next;
        });
      }
    },
    [persist, running]
  );

  
  const runAll = useCallback(async () => {
    if (runningAll) return;
    setRunningAll(true);
    try {
      const f = fileRef.current;
      const parsed = safeParse(f?.content);
      if (!parsed.ok) return;
      for (let i = 0; i < parsed.nb.cells.length; i++) {
        const cell = parsed.nb.cells[i];
        if (cell.type === 'code' && cell.source.trim()) {
          await runCell(i);
        }
      }
    } finally {
      setRunningAll(false);
    }
  }, [runCell, runningAll]);

  
  const parsed = file ? safeParse(file.content) : { ok: false, loading: true };
  const nb = parsed.ok ? parsed.nb : null;
  const fileLanguage = nb?.language === 'javascript' ? 'javascript' : 'python';
  const cells = nb?.cells ?? [];

  const showCreateForm = showCreate || notebooks.length === 0;

  return (
    <div className="fixed inset-0 z-[65] bg-[#0A0E17] text-slate-200 flex flex-col animate-fade-in">
      { }
      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10 bg-white/[0.02]">
        <NotebookPen size={18} className="text-[#58A6FF]" />
        <span className="font-semibold text-[15px] text-slate-100">Notebook</span>

        {notebooks.length > 0 && !showCreateForm && (
          <>
            <select
              value={selectedId || ''}
              onChange={(e) => setSelectedId(e.target.value)}
              className="ml-2 text-[13px] bg-[#0D1220] border border-white/10 rounded-md px-2 py-1.5 text-slate-200 outline-none focus:border-[#58A6FF]/60 max-w-[220px]"
            >
              {notebooks.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.name}
                </option>
              ))}
            </select>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-[#58A6FF]/15 text-[#58A6FF] border border-[#58A6FF]/30">
              {fileLanguage === 'python' ? 'Python' : 'JavaScript'}
            </span>
            <button
              onClick={() => setShowCreate(true)}
              title="New notebook"
              className="p-1.5 rounded-md text-slate-400 hover:text-slate-100 hover:bg-white/10 transition-colors"
            >
              <Plus size={16} />
            </button>
          </>
        )}

        <div className="flex-1" />

        {file && !showCreateForm && (
          <button
            onClick={runAll}
            disabled={runningAll}
            className="flex items-center gap-1.5 text-[13px] px-3 py-1.5 rounded-md bg-[#58A6FF]/15 border border-[#58A6FF]/40 text-[#58A6FF] hover:bg-[#58A6FF]/25 disabled:opacity-50 transition-colors"
          >
            {runningAll ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
            {runningAll ? 'Running…' : 'Run All'}
          </button>
        )}
        <button
          onClick={onClose}
          title="Close (Esc)"
          className="p-1.5 rounded-md text-slate-400 hover:text-slate-100 hover:bg-white/10 transition-colors"
        >
          <X size={17} />
        </button>
      </div>

      { }
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="max-w-3xl mx-auto">
          {showCreateForm ? (
            <div className="mt-16 mx-auto max-w-md text-center border border-white/10 rounded-xl bg-white/[0.02] p-8">
              <NotebookPen size={32} className="mx-auto text-[#58A6FF] mb-4" />
              <h2 className="text-lg font-semibold text-slate-100 mb-1">
                {notebooks.length === 0 ? 'No notebooks yet' : 'New notebook'}
              </h2>
              <p className="text-[13px] text-slate-400 mb-5">
                Cell-based scratchpads that run with the same engine as the toolbar Run button.
              </p>
              <input
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                placeholder="notebook"
                className="w-full text-[13px] bg-[#0D1220] border border-white/10 rounded-md px-3 py-2 mb-3 text-slate-200 outline-none focus:border-[#58A6FF]/60"
              />
              <select
                value={createLang}
                onChange={(e) => setCreateLang(e.target.value)}
                className="w-full text-[13px] bg-[#0D1220] border border-white/10 rounded-md px-3 py-2 mb-4 text-slate-200 outline-none focus:border-[#58A6FF]/60"
              >
                <option value="python">Python</option>
                <option value="javascript">JavaScript</option>
              </select>
              <div className="flex gap-2 justify-center">
                <button
                  onClick={handleCreate}
                  className="text-[13px] px-4 py-2 rounded-md bg-[#58A6FF] text-[#0A0E17] font-semibold hover:bg-[#7db9ff] transition-colors"
                >
                  Create Notebook
                </button>
                {notebooks.length > 0 && (
                  <button
                    onClick={() => setShowCreate(false)}
                    className="text-[13px] px-4 py-2 rounded-md border border-white/15 text-slate-300 hover:bg-white/5 transition-colors"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </div>
          ) : parsed.loading ? (
            <div className="mt-20 text-center text-slate-500 text-sm">Loading notebook…</div>
          ) : parsed.corrupted ? (
            <div className="mt-20 mx-auto max-w-md text-center border border-red-500/30 rounded-xl bg-red-500/5 p-8">
              <h2 className="text-lg font-semibold text-red-300 mb-1">This notebook file is corrupted</h2>
              <p className="text-[13px] text-slate-400 mb-5">
                The .nb file does not contain valid notebook JSON. Resetting will replace it with a
                fresh empty notebook.
              </p>
              <button
                onClick={handleReset}
                className="text-[13px] px-4 py-2 rounded-md bg-red-500/20 border border-red-500/40 text-red-200 hover:bg-red-500/30 transition-colors"
              >
                Reset notebook
              </button>
            </div>
          ) : (
            <div>
              <AddCellBar onAddCode={() => addCell(0, 'code')} onAddMd={() => addCell(0, 'md')} />
              {cells.map((cell, i) => {
                const lines = String(cell.source || '').split('\n').length;
                const isRunning = running.has(i);
                return (
                  <div key={i}>
                    <div className="border border-white/10 rounded-lg bg-white/[0.02] mb-1">
                      { }
                      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-white/[0.07]">
                        <span
                          className={`text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded ${
                            cell.type === 'code'
                              ? 'bg-[#58A6FF]/15 text-[#58A6FF]'
                              : 'bg-[#D9FF3F]/10 text-[#D9FF3F]'
                          }`}
                        >
                          {cell.type === 'code' ? 'Code' : 'Markdown'}
                        </span>
                        <div className="flex-1" />
                        {cell.type === 'code' && (
                          <button
                            onClick={() => runCell(i)}
                            disabled={isRunning}
                            title="Run cell"
                            className="p-1 rounded text-slate-400 hover:text-[#58A6FF] hover:bg-white/10 disabled:opacity-50 transition-colors"
                          >
                            {isRunning ? (
                              <Loader2 size={14} className="animate-spin" />
                            ) : (
                              <Play size={14} />
                            )}
                          </button>
                        )}
                        <button
                          onClick={() => moveCell(i, -1)}
                          disabled={i === 0}
                          title="Move up"
                          className="p-1 rounded text-slate-400 hover:text-slate-100 hover:bg-white/10 disabled:opacity-30 transition-colors"
                        >
                          <ChevronUp size={14} />
                        </button>
                        <button
                          onClick={() => moveCell(i, 1)}
                          disabled={i === cells.length - 1}
                          title="Move down"
                          className="p-1 rounded text-slate-400 hover:text-slate-100 hover:bg-white/10 disabled:opacity-30 transition-colors"
                        >
                          <ChevronDown size={14} />
                        </button>
                        <button
                          onClick={() => deleteCell(i)}
                          title="Delete cell"
                          className="p-1 rounded text-slate-400 hover:text-red-300 hover:bg-white/10 transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>

                      { }
                      {cell.type === 'code' ? (
                        <div>
                          <textarea
                            value={cell.source || ''}
                            onChange={(e) => updateCellSource(i, e.target.value)}
                            rows={Math.min(12, Math.max(2, lines))}
                            spellCheck={false}
                            placeholder={
                              fileLanguage === 'python' ? '# write python here' : '// write javascript here'
                            }
                            className="w-full bg-[#0D1220] font-mono text-[12.5px] leading-relaxed text-slate-200 px-3 py-2 outline-none resize-y border-b border-white/[0.07] rounded-b-none"
                          />
                          {cell.output ? (
                            <div className="border-t border-white/[0.07]">
                              <div className="flex items-center px-3 pt-2">
                                <span className="text-[10px] uppercase tracking-widest text-slate-500">
                                  output
                                </span>
                                <div className="flex-1" />
                                <button
                                  onClick={() => clearOutput(i)}
                                  title="Clear output"
                                  className="p-1 rounded text-slate-500 hover:text-slate-200 hover:bg-white/10 transition-colors"
                                >
                                  <X size={13} />
                                </button>
                              </div>
                              <pre
                                className={`font-mono text-[12px] p-3 pt-1 whitespace-pre-wrap break-words ${
                                  cell.error ? 'text-red-300' : 'text-slate-300'
                                }`}
                              >
                                {cell.output}
                              </pre>
                            </div>
                          ) : null}
                        </div>
                      ) : editingMd === i ? (
                        <div>
                          <textarea
                            value={cell.source || ''}
                            onChange={(e) => updateCellSource(i, e.target.value)}
                            rows={Math.min(12, Math.max(4, lines))}
                            spellCheck={false}
                            placeholder="# Markdown… (click Done to preview)"
                            className="w-full bg-[#0D1220] text-[13px] leading-relaxed text-slate-200 px-3 py-2 outline-none resize-y"
                          />
                          <div className="flex justify-end px-3 pb-2">
                            <button
                              onClick={() => setEditingMd(null)}
                              className="flex items-center gap-1 text-[12px] px-3 py-1 rounded-md bg-[#58A6FF]/15 border border-[#58A6FF]/40 text-[#58A6FF] hover:bg-[#58A6FF]/25 transition-colors"
                            >
                              <Check size={13} /> Done
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="px-3 py-2" onClick={() => setEditingMd(i)}>
                          <MarkdownView source={cell.source} />
                        </div>
                      )}
                    </div>
                    <AddCellBar
                      onAddCode={() => addCell(i + 1, 'code')}
                      onAddMd={() => addCell(i + 1, 'md')}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      { }
      <div className="px-4 py-2 border-t border-white/10 bg-white/[0.02] text-center">
        <span className="text-[11px] text-slate-500">
          Runs use the JDoodle free tier (20 runs/day). Outputs are saved inside the .nb file.
        </span>
      </div>
    </div>
  );
}


export function NotebookHost() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener('synapse:open-notebook', handler);
    return () => window.removeEventListener('synapse:open-notebook', handler);
  }, []);

  if (!open) return null;
  return <NotebookPanel onClose={() => setOpen(false)} />;
}
