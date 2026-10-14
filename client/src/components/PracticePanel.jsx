import { useState, useEffect, useCallback } from 'react';
import {
  X,
  ChevronLeft,
  Play,
  Trophy,
  FolderOpen,
  CheckCircle2,
  XCircle,
  Loader2,
} from 'lucide-react';
import { useFiles } from '../contexts/FileContext';
import { executeCode } from '../services/api';
import { PRACTICE_PROBLEMS, PRACTICE_LANGUAGES } from '../practice/problems';

const DIFF_STYLE = {
  Easy: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  Medium: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  Hard: 'bg-red-500/15 text-red-400 border-red-500/30',
};

function normalizeOutput(value) {
  return String(value ?? '')
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.replace(/[ \t]+$/, ''))
    .join('\n')
    .trim();
}

export default function PracticePanel({ theme, onClose }) {
  const { files, createFile, createFolder, updateContent, openTab } = useFiles();
  const [view, setView] = useState('list'); // 'list' | 'detail'
  const [selected, setSelected] = useState(null);
  const [lang, setLang] = useState(PRACTICE_LANGUAGES[0]);
  const [linked, setLinked] = useState(null); // { fileId, langId, slug }
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState([]);
  const [runNote, setRunNote] = useState('');
  const [linkedNote, setLinkedNote] = useState('');

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const openProblem = (problem) => {
    setSelected(problem);
    setResults([]);
    setRunNote('');
    setLinkedNote('');
    setView('detail');
  };

  const goBack = () => {
    setView('list');
    setSelected(null);
    setResults([]);
    setRunNote('');
  };

  const openInEditor = useCallback(() => {
    if (!selected) return;
    const folderName = 'practice';
    let folder = files.find(
      (f) => f.type === 'folder' && f.parentId === null && f.name === folderName
    );
    const folderId = folder ? folder.id : createFolder(folderName, null);
    const fileName = `${selected.slug}.${lang.ext}`;
    let file = files.find(
      (f) => f.type === 'file' && f.parentId === folderId && f.name === fileName
    );
    const fileId = file ? file.id : createFile(fileName, folderId);
    updateContent(fileId, selected.starter[lang.key] || '');
    openTab(fileId);
    setLinked({ fileId, langId: lang.id, slug: selected.slug });
    setResults([]);
    setRunNote('');
    setLinkedNote(`Opened practice/${fileName} — write your solution there, then hit Run Tests.`);
  }, [files, selected, lang, createFolder, createFile, updateContent, openTab]);

  const runTests = useCallback(async () => {
    if (!selected || !linked || running) return;
    const file = files.find((f) => f.id === linked.fileId);
    const source = file?.content ?? '';
    if (!source.trim()) {
      setRunNote('The file is empty — write your solution first.');
      return;
    }
    setRunning(true);
    setResults([]);
    setRunNote('Running tests… (one run per test case)');
    const rows = [];
    for (const test of selected.tests) {
      try {
        const result = await executeCode(source, linked.langId, test.input);
        const got = result?.stdout ?? result?.output ?? '';
        const compileErr = result?.compile_output ? String(result.compile_output).trim() : '';
        const passed = !compileErr && normalizeOutput(got) === normalizeOutput(test.output);
        rows.push({
          input: test.input,
          expected: test.output,
          got: compileErr ? `(compile error)\n${compileErr}` : got,
          passed,
        });
      } catch (err) {
        rows.push({
          input: test.input,
          expected: test.output,
          got: err?.message || 'Execution failed',
          passed: false,
        });
      }
      setResults([...rows]);
    }
    const passedCount = rows.filter((r) => r.passed).length;
    setRunNote(`${passedCount}/${rows.length} tests passed`);
    setRunning(false);
  }, [selected, linked, files, running]);

  const canRun = linked && selected && linked.slug === selected.slug && !running;

  const chip = (label, className) => (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-md border text-[10px] font-bold uppercase tracking-wider ${className}`}
    >
      {label}
    </span>
  );

  return (
    <div className="fixed inset-y-0 right-0 w-[440px] max-w-[92vw] z-[70] bg-(--paper-2) border-l border-(--line) flex flex-col shadow-[0_0_48px_rgba(0,0,0,0.45)] animate-fade-in">
      {/* Header */}
      <div className="px-4 py-3 flex items-center gap-2.5 shrink-0 border-b border-(--line)">
        <span className="w-8 h-8 rounded-md border border-(--line) flex items-center justify-center text-(--blue)">
          <Trophy size={16} />
        </span>
        <div className="flex flex-col min-w-0">
          <span className="text-[13px] font-extrabold text-(--ink)">Practice Arena</span>
          <span className="font-mono text-[10px] text-(--muted)">12 problems · code in the editor, test here</span>
        </div>
        <button
          onClick={onClose}
          className="ml-auto p-1.5 rounded-md text-(--muted) hover:text-(--red) hover:bg-(--ink)/5 transition-colors cursor-pointer"
          title="Close"
        >
          <X size={16} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar min-h-0">
        {view === 'list' && (
          <div className="flex flex-col gap-2 p-3">
            {PRACTICE_PROBLEMS.map((p) => (
              <button
                key={p.id}
                onClick={() => openProblem(p)}
                className="text-left p-3 rounded-lg border border-(--line) bg-(--paper) hover:border-(--blue)/50 transition-colors cursor-pointer group"
              >
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-bold text-(--ink) group-hover:text-(--blue) transition-colors flex-1 truncate">
                    {p.title}
                  </span>
                  {chip(p.difficulty, DIFF_STYLE[p.difficulty] || '')}
                </div>
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {p.tags.map((t) => (
                    <span key={t} className="font-mono text-[10px] text-(--muted) border border-(--line) rounded px-1.5 py-0.5">
                      {t}
                    </span>
                  ))}
                </div>
              </button>
            ))}
          </div>
        )}

        {view === 'detail' && selected && (
          <div className="flex flex-col p-4 gap-4">
            <button
              onClick={goBack}
              className="self-start flex items-center gap-1 text-[12px] font-bold text-(--muted) hover:text-(--ink) transition-colors cursor-pointer"
            >
              <ChevronLeft size={14} /> All problems
            </button>

            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-[16px] font-extrabold text-(--ink)">{selected.title}</h2>
                {chip(selected.difficulty, DIFF_STYLE[selected.difficulty] || '')}
              </div>
              <div className="mt-1.5 flex flex-wrap gap-1">
                {selected.tags.map((t) => (
                  <span key={t} className="font-mono text-[10px] text-(--muted) border border-(--line) rounded px-1.5 py-0.5">
                    {t}
                  </span>
                ))}
              </div>
            </div>

            <p className="text-[13px] leading-relaxed text-(--ink) whitespace-pre-wrap">
              {selected.statement}
            </p>

            {selected.examples.map((ex, i) => (
              <div key={i} className="flex flex-col gap-1.5">
                <span className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-(--muted)">
                  Example {i + 1}
                </span>
                <div className="rounded-md border border-(--line) bg-(--paper) overflow-hidden">
                  <div className="px-3 py-1.5 border-b border-(--line) font-mono text-[10px] font-bold text-(--muted)">
                    Input
                  </div>
                  <pre className="px-3 py-2 font-mono text-[12px] text-(--ink) whitespace-pre-wrap">{ex.input}</pre>
                </div>
                <div className="rounded-md border border-(--line) bg-(--paper) overflow-hidden">
                  <div className="px-3 py-1.5 border-b border-(--line) font-mono text-[10px] font-bold text-(--muted)">
                    Output
                  </div>
                  <pre className="px-3 py-2 font-mono text-[12px] text-(--ink) whitespace-pre-wrap">{ex.output}</pre>
                </div>
                {ex.explanation && (
                  <p className="text-[12px] text-(--muted) italic">{ex.explanation}</p>
                )}
              </div>
            ))}

            <div className="flex items-center gap-2">
              <label className="text-[12px] font-bold text-(--muted)">Language</label>
              <select
                value={lang.id}
                onChange={(e) => setLang(PRACTICE_LANGUAGES.find((l) => l.id === Number(e.target.value)))}
                className="flex-1 px-2.5 py-2 rounded-md border border-(--line) bg-(--paper) text-(--ink) text-[13px] outline-none focus:border-(--blue)/60 cursor-pointer"
              >
                {PRACTICE_LANGUAGES.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex gap-2">
              <button
                onClick={openInEditor}
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-md border border-(--blue)/50 text-(--blue) text-[13px] font-bold hover:bg-(--blue)/10 transition-colors cursor-pointer"
              >
                <FolderOpen size={14} /> Open in Editor
              </button>
              <button
                onClick={runTests}
                disabled={!canRun}
                className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-md text-[13px] font-bold transition-colors ${
                  canRun
                    ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/40 hover:bg-emerald-500/25 cursor-pointer'
                    : 'border border-(--line) text-(--muted) opacity-50 cursor-not-allowed'
                }`}
              >
                {running ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
                Run Tests
              </button>
            </div>

            {linkedNote && (
              <p className="font-mono text-[11px] text-(--muted)">{linkedNote}</p>
            )}

            {runNote && (
              <p className={`font-mono text-[12px] font-bold ${results.some((r) => r.passed) ? 'text-emerald-400' : 'text-(--muted)'}`}>
                {runNote}
              </p>
            )}

            {results.length > 0 && (
              <div className="flex flex-col gap-2">
                {results.map((r, i) => (
                  <div key={i} className="rounded-md border border-(--line) bg-(--paper) overflow-hidden">
                    <div className="flex items-center gap-2 px-3 py-1.5 border-b border-(--line)">
                      <span className="font-mono text-[11px] font-bold text-(--muted)">Test {i + 1}</span>
                      {r.passed ? (
                        <span className="ml-auto inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border bg-emerald-500/15 text-emerald-400 border-emerald-500/30">
                          <CheckCircle2 size={11} /> Pass
                        </span>
                      ) : (
                        <span className="ml-auto inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border bg-red-500/15 text-red-400 border-red-500/30">
                          <XCircle size={11} /> Fail
                        </span>
                      )}
                    </div>
                    <div className="px-3 py-2 grid grid-cols-1 gap-1.5 font-mono text-[11px]">
                      <div>
                        <span className="text-(--muted)">in&nbsp;&nbsp;</span>
                        <span className="text-(--ink) whitespace-pre-wrap">{r.input}</span>
                      </div>
                      <div>
                        <span className="text-(--muted)">want&nbsp;</span>
                        <span className="text-(--ink) whitespace-pre-wrap">{r.expected}</span>
                      </div>
                      <div>
                        <span className="text-(--muted)">got&nbsp;&nbsp;</span>
                        <span className={r.passed ? 'text-emerald-400' : 'text-red-400'} style={{ whiteSpace: 'pre-wrap' }}>
                          {String(r.got).slice(0, 500) || '(no output)'}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="px-4 py-2.5 shrink-0 border-t border-(--line)">
        <p className="font-mono text-[10px] text-(--muted) leading-relaxed">
          Runs use the JDoodle free tier (20 runs/day) — a full test suite uses one run per test case.
        </p>
      </div>
    </div>
  );
}

export function PracticeHost({ theme }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener('synapse:open-practice', onOpen);
    return () => window.removeEventListener('synapse:open-practice', onOpen);
  }, []);

  if (!open) return null;
  return <PracticePanel theme={theme} onClose={() => setOpen(false)} />;
}
