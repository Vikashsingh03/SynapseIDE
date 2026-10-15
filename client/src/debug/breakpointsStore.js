





const STORAGE_KEY = 'synapse-breakpoints';


let store = new Map();
try {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    const obj = JSON.parse(raw);
    for (const [k, v] of Object.entries(obj)) {
      if (Array.isArray(v)) {
        store.set(String(k), new Set(v.filter((n) => Number.isInteger(n) && n > 0)));
      }
    }
  }
} catch {}

const listeners = new Set();

function persist() {
  try {
    const obj = {};
    for (const [k, set] of store) obj[k] = [...set];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
  } catch {}
}

function notify() {
  persist();
  for (const fn of listeners) {
    try {
      fn();
    } catch {}
  }
}

export function getBreakpoints(relPath) {
  const set = store.get(String(relPath || ''));
  if (!set) return [];
  return [...set].sort((a, b) => a - b);
}

export function toggleBreakpoint(relPath, line) {
  const key = String(relPath || '');
  if (!key || !Number.isInteger(line) || line < 1) return;
  let set = store.get(key);
  if (!set) {
    set = new Set();
    store.set(key, set);
  }
  if (set.has(line)) set.delete(line);
  else set.add(line);
  if (set.size === 0) store.delete(key);
  notify();
}

export function clearBreakpoints(relPath) {
  store.delete(String(relPath || ''));
  notify();
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}




export function relPathOf(file, files) {
  if (!file) return null;
  const byId = new Map((files || []).map((f) => [f.id, f]));
  const parts = [file.name];
  const seen = new Set([file.id]);
  let cur = file;
  while (cur.parentId && byId.has(cur.parentId) && !seen.has(cur.parentId)) {
    seen.add(cur.parentId);
    cur = byId.get(cur.parentId);
    parts.unshift(cur.name);
  }
  return parts.join('/');
}
