













let monacoProblems = [];
let typecheckProblems = [];
const listeners = new Set();

function notify() {
  for (const listener of [...listeners]) {
    try {
      listener();
    } catch {}
  }
}

const SEVERITIES = new Set(['error', 'warning', 'info']);

function normalize(problem) {
  const p = problem && typeof problem === 'object' ? problem : {};
  const severity = SEVERITIES.has(p.severity) ? p.severity : 'info';
  return {
    fileId: p.fileId ?? null,
    fileName: typeof p.fileName === 'string' && p.fileName ? p.fileName : 'unknown',
    path: typeof p.path === 'string' ? p.path : null,
    line: Number.isFinite(Number(p.line)) && Number(p.line) > 0 ? Number(p.line) : 1,
    column: Number.isFinite(Number(p.column)) && Number(p.column) > 0 ? Number(p.column) : 1,
    severity,
    message: typeof p.message === 'string' ? p.message : String(p.message ?? ''),
    source: p.source === 'typecheck' ? 'typecheck' : 'monaco',
  };
}

 
export function setMonacoProblems(list) {
  monacoProblems = Array.isArray(list) ? list.map(normalize) : [];
  notify();
}

 
export function setTypecheckProblems(list) {
  typecheckProblems = Array.isArray(list) ? list.map(normalize) : [];
  notify();
}

 
export function getProblems() {
  return [...monacoProblems, ...typecheckProblems];
}

 
export function getCounts() {
  let errors = 0;
  let warnings = 0;
  for (const p of [...monacoProblems, ...typecheckProblems]) {
    if (p.severity === 'error') errors += 1;
    else if (p.severity === 'warning') warnings += 1;
  }
  return { errors, warnings };
}

 
export function clearProblems() {
  monacoProblems = [];
  typecheckProblems = [];
  notify();
}

 
export function subscribe(listener) {
  if (typeof listener !== 'function') return () => {};
  listeners.add(listener);
  return () => listeners.delete(listener);
}
