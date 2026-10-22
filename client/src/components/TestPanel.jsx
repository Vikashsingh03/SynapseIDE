






import { useEffect, useMemo, useState } from 'react';
import { FlaskConical, Play, X, Check, Loader2, Sparkles } from 'lucide-react';
import { useFiles } from '../contexts/FileContext';
import { API_BASE } from '../config/apiConfig';
import { getToken } from '../services/authService';
import {
  testFileNameFor,
  cleanGeneratedTests,
  looksLikeNodeTests,
  buildGenerateRequest,
} from '../utils/testGen';

const TEST_RE = /\.(test|spec)\.(js|mjs|cjs|ts|mts)$/;
const SOURCE_RE = /\.(js|mjs|cjs)$/;


function relPathOf(file, files) {
  const byId = new Map((files || []).map((f) => [f.id, f]));
  const parts = [file.name];
  const seen = new Set([file.id]);
  let parentId = file.parentId || null;
  while (parentId) {
    if (seen.has(parentId)) break;
    seen.add(parentId);
    const parent = byId.get(parentId);
    if (!parent || parent.type !== 'folder') break;
    parts.unshift(parent.name);
    parentId = parent.parentId || null;
  }
  return parts.join('/');
}

function roomIdFromPath() {
  const m = window.location.pathname.match(/^\/room\/([A-Za-z0-9]{1,16})/);
  return m ? m[1] : undefined;
}

const payloadFiles = (files) =>
  (files || []).map((f) => ({
    id: f.id,
    name: f.name,
    type: f.type,
    parentId: f.parentId,
    content: f.content,
  }));

function StatusChip({ state }) {
  if (!state || state.status === 'idle') {
    return (
      <span className="text-[10px] font-bold uppercase tracking-wide text-(--muted) border border-(--line) rounded-full px-2 py-0.5">
        idle
      </span>
    );
  }
  if (state.status === 'running') {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-(--blue) border border-(--blue)/30 bg-(--blue)/10 rounded-full px-2 py-0.5">
        <Loader2 size={10} className="animate-spin" /> running
      </span>
    );
  }
  if (state.status === 'error') {
    return (
      <span className="text-[10px] font-bold uppercase tracking-wide text-amber-400 border border-amber-400/30 bg-amber-400/10 rounded-full px-2 py-0.5">
        error
      </span>
    );
  }
  if (state.fail > 0) {
    return (
      <span className="text-[10px] font-bold uppercase tracking-wide text-red-400 border border-red-400/30 bg-red-400/10 rounded-full px-2 py-0.5">
        {state.fail} fail · {state.pass} pass
      </span>
    );
  }
  return (
    <span className="text-[10px] font-bold uppercase tracking-wide text-emerald-400 border border-emerald-400/30 bg-emerald-400/10 rounded-full px-2 py-0.5">
      {state.pass} pass
    </span>
  );
}

function TestPanel({ onClose }) {
  const { files, activeFile, createFile, updateContent } = useFiles();
  const [states, setStates] = useState({});
  const [expandedId, setExpandedId] = useState(null);
  const [runningAll, setRunningAll] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [genResult, setGenResult] = useState(null);
  const [genError, setGenError] = useState(null);

  const activeIsSource =
    !!activeFile &&
    activeFile.type !== 'folder' &&
    SOURCE_RE.test(activeFile.name || '') &&
    !TEST_RE.test(activeFile.name || '');

  const generateTests = async () => {
    if (!activeFile || generating) return;
    setGenerating(true);
    setGenError(null);
    setGenResult(null);
    try {
      const token = getToken();
      const res = await fetch(`${API_BASE}/ai/generate-tests`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(buildGenerateRequest({ file: activeFile })),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      const code = cleanGeneratedTests(data?.code || '');
      if (!code) throw new Error('Neura returned an empty response. Try again.');
      const targetName = testFileNameFor(activeFile.name);
      const existing = (files || []).find(
        (f) =>
          f.type !== 'folder' &&
          f.name === targetName &&
          (f.parentId || null) === (activeFile.parentId || null)
      );
      setGenResult({
        targetName,
        code,
        existingId: existing ? existing.id : null,
        looksOk: looksLikeNodeTests(code),
      });
    } catch (err) {
      setGenError(err?.message || 'Test generation failed');
    } finally {
      setGenerating(false);
    }
  };

  const createGenerated = () => {
    if (!genResult) return;
    if (genResult.existingId) {
      updateContent(genResult.existingId, genResult.code);
    } else if (activeFile) {
      const id = createFile(genResult.targetName, activeFile.parentId || null);
      updateContent(id, genResult.code);
    }
    setGenResult(null);
  };

  const testFiles = useMemo(
    () =>
      (files || [])
        .filter((f) => f.type !== 'folder' && TEST_RE.test(f.name || ''))
        .map((f) => ({ ...f, rel: relPathOf(f, files) }))
        .sort((a, b) => a.rel.localeCompare(b.rel)),
    [files]
  );

  const setStateFor = (id, patch) =>
    setStates((prev) => ({ ...prev, [id]: { ...(prev[id] || { status: 'idle' }), ...patch } }));

  const runOne = async (file) => {
    setStateFor(file.id, { status: 'running' });
    try {
      const token = getToken();
      const res = await fetch(`${API_BASE}/testrun`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          roomId: roomIdFromPath(),
          files: payloadFiles(files),
          testFile: file.rel,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      setStateFor(file.id, {
        status: data.timedOut ? 'error' : data.fail > 0 ? 'fail' : 'pass',
        pass: data.pass,
        fail: data.fail,
        skipped: data.skipped,
        total: data.total,
        tests: data.tests || [],
        raw: data.raw || '',
        durationMs: data.durationMs,
        exitCode: data.exitCode,
        timedOut: data.timedOut,
        error: data.timedOut ? 'Timed out after 60s.' : null,
      });
    } catch (err) {
      setStateFor(file.id, { status: 'error', error: err?.message || 'Run failed' });
    }
  };

  const runAll = async () => {
    if (runningAll) return;
    setRunningAll(true);
    try {
      for (const f of testFiles) {
        
        await runOne(f);
      }
    } finally {
      setRunningAll(false);
    }
  };

  const anyRunning = runningAll || Object.values(states).some((s) => s?.status === 'running');

  return (
    <div className="flex flex-col h-full bg-(--paper-2) text-(--ink)">
      { }
      <div className="flex items-center gap-2.5 px-4 h-[52px] border-b border-(--line) shrink-0">
        <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-(--blue)/15 text-(--blue)">
          <FlaskConical size={16} />
        </span>
        <div className="flex-1 min-w-0">
          <h2 className="text-[13.5px] font-bold leading-tight">Test Explorer</h2>
          <p className="text-[11px] text-(--muted) leading-tight">node:test files in this project</p>
        </div>
        <button
          onClick={generateTests}
          disabled={!activeIsSource || generating}
          title={
            activeIsSource
              ? `Generate tests for ${activeFile.name} with Neura`
              : 'Open a .js, .mjs or .cjs source file to generate tests'
          }
          className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-[12px] font-bold border border-(--line) text-(--ink) hover:bg-(--hover) disabled:opacity-50 disabled:cursor-not-allowed transition shrink-0"
        >
          {generating ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
          {generating ? 'Generating…' : 'Generate with Neura'}
        </button>
        {testFiles.length > 0 && (
          <button
            onClick={runAll}
            disabled={anyRunning}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-[12px] font-bold bg-(--blue) text-white hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {runningAll ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />}
            Run All
          </button>
        )}
        <button
          onClick={onClose}
          aria-label="Close"
          className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-(--muted) hover:text-(--ink) hover:bg-(--hover) transition"
        >
          <X size={15} />
        </button>
      </div>

      {(genError || genResult) && (
        <div className="px-3 pt-3 shrink-0">
          {genError && (
            <div className="rounded-xl border border-red-400/30 bg-red-400/10 px-3 py-2.5 flex items-start gap-2">
              <p className="flex-1 text-[12px] text-red-300 font-mono leading-relaxed">{genError}</p>
              <button
                onClick={() => setGenError(null)}
                aria-label="Dismiss"
                className="text-(--muted) hover:text-(--ink) transition shrink-0"
              >
                <X size={13} />
              </button>
            </div>
          )}
          {genResult && (
            <div className="rounded-xl border border-(--line) bg-(--paper) overflow-hidden">
              <div className="px-3 py-2.5 border-b border-(--line)">
                <p className="text-[13px] font-semibold truncate">{genResult.targetName}</p>
                <p className="text-[11px] font-mono text-(--muted) truncate">
                  {genResult.existingId
                    ? 'a file with this name already exists in the same folder'
                    : 'new test file, next to the source file'}
                </p>
              </div>
              {!genResult.looksOk && (
                <p className="px-3 py-2 text-[12px] text-amber-400 leading-relaxed border-b border-(--line)">
                  Neura ka output test jaisa nahi lag raha — file bana sakte ho, pehle preview dekh
                  lo.
                </p>
              )}
              <pre className="px-3 py-2.5 font-mono text-[11px] leading-relaxed whitespace-pre-wrap break-words max-h-[300px] overflow-y-auto">
                {genResult.code.split('\n').slice(0, 40).join('\n')}
                {genResult.code.split('\n').length > 40
                  ? `\n… ${genResult.code.split('\n').length - 40} more lines`
                  : ''}
              </pre>
              <div className="flex items-center gap-2 px-3 py-2.5 border-t border-(--line)">
                <button
                  onClick={createGenerated}
                  className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-[12px] font-bold bg-(--blue) text-white hover:brightness-110 transition"
                >
                  <Check size={13} />
                  {genResult.existingId
                    ? 'Replace existing test file'
                    : `Create ${genResult.targetName}`}
                </button>
                <button
                  onClick={() => setGenResult(null)}
                  className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-[12px] font-bold border border-(--line) text-(--ink) hover:bg-(--hover) transition"
                >
                  <X size={13} />
                  Discard
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      { }
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {testFiles.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-6 py-16">
            <FlaskConical size={28} className="text-(--muted) mb-3" />
            <p className="text-[13px] font-bold mb-1.5">No test files found</p>
            <p className="text-[12px] text-(--muted) leading-relaxed font-mono">
              Create something like <span className="text-(--ink)">math.test.js</span> using
              <br />
              <span className="text-(--ink)">node:test</span> +{' '}
              <span className="text-(--ink)">node:assert</span>.
            </p>
          </div>
        ) : (
          testFiles.map((f) => {
            const st = states[f.id];
            const expanded = expandedId === f.id;
            return (
              <div
                key={f.id}
                className="rounded-xl border border-(--line) bg-(--paper) overflow-hidden"
              >
                <div className="flex items-center gap-2.5 px-3 py-2.5">
                  <button
                    onClick={() => setExpandedId(expanded ? null : f.id)}
                    className="flex-1 min-w-0 text-left"
                    title={st?.tests?.length ? 'Expand results' : f.rel}
                  >
                    <p className="text-[13px] font-semibold truncate">{f.name}</p>
                    <p className="text-[11px] font-mono text-(--muted) truncate">{f.rel}</p>
                  </button>
                  <StatusChip state={st} />
                  <button
                    onClick={() => runOne(f)}
                    disabled={anyRunning}
                    title={anyRunning ? 'Running…' : `Run ${f.name}`}
                    className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-(--blue) hover:bg-(--blue)/15 disabled:opacity-40 disabled:cursor-not-allowed transition"
                  >
                    {st?.status === 'running' ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Play size={14} />
                    )}
                  </button>
                </div>

                {expanded && st && st.status !== 'idle' && st.status !== 'running' && (
                  <div className="border-t border-(--line) px-3 py-2.5">
                    {st.error && (
                      <p className="text-[12px] text-amber-400 font-mono mb-2">{st.error}</p>
                    )}
                    {(st.tests || []).length > 0 ? (
                      <ul className="space-y-1 mb-2">
                        {st.tests.map((t, i) => (
                          <li key={i} className="flex items-start gap-2 text-[12px]">
                            {t.ok && !t.skipped ? (
                              <Check size={13} className="text-emerald-400 shrink-0 mt-0.5" />
                            ) : t.skipped ? (
                              <span className="text-[10px] font-bold text-(--muted) border border-(--line) rounded px-1 shrink-0 mt-0.5">
                                SKIP
                              </span>
                            ) : (
                              <X size={13} className="text-red-400 shrink-0 mt-0.5" />
                            )}
                            <span
                              className={
                                t.ok ? 'text-(--ink)' : 'text-red-300 font-semibold'
                              }
                            >
                              {t.name}
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-[12px] text-(--muted) mb-2">
                        No TAP tests parsed — see raw output.
                      </p>
                    )}
                    <p className="text-[11px] font-mono text-(--muted) mb-1.5">
                      {st.timedOut ? 'timed out (60s)' : `exit ${st.exitCode}`}
                      {typeof st.durationMs === 'number' ? ` · ${st.durationMs}ms` : ''}
                    </p>
                    <details className="text-[11px]">
                      <summary className="cursor-pointer text-(--muted) hover:text-(--ink) font-mono">
                        raw output
                      </summary>
                      <pre className="mt-1.5 p-2.5 rounded-lg bg-(--paper-2) border border-(--line) font-mono text-[11px] leading-relaxed whitespace-pre-wrap break-words max-h-[240px] overflow-y-auto">
                        {st.raw || '(empty)'}
                      </pre>
                    </details>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      { }
      <div className="px-4 py-2.5 border-t border-(--line) shrink-0">
        <p className="text-[11px] text-(--muted) leading-relaxed">
          Runs with Node's built-in test runner (<span className="font-mono">node --test</span>) in
          the server workspace. For Jest/Vitest projects, use the integrated terminal.
        </p>
      </div>
    </div>
  );
}

export function TestHost() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onOpen = () => setOpen(true);
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('synapse:open-tests', onOpen);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('synapse:open-tests', onOpen);
      window.removeEventListener('keydown', onKey);
    };
  }, []);

  if (!open) return null;
  return (
    <div className="fixed inset-y-0 right-0 w-[520px] max-w-[94vw] z-[70] bg-(--paper-2) border-l border-(--line) flex flex-col shadow-[0_0_48px_rgba(0,0,0,0.45)] animate-fade-in">
      <TestPanel onClose={() => setOpen(false)} />
    </div>
  );
}

export default TestPanel;
