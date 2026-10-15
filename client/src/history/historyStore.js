




const STORAGE_KEY = 'synapse-history-v1';
const MAX_PER_FILE = 25;
const MAX_CONTENT_CHARS = 200_000;

let cache = null; 

function load() {
  if (cache) return cache;
  cache = {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') cache = parsed;
    }
  } catch {
    cache = {};
  }
  return cache;
}

function persist() {
  const data = cache || {};
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch (e) {
    if (!isQuotaError(e)) return false;
    
    let oldest = null;
    let oldestFile = null;
    let oldestIdx = -1;
    for (const fid of Object.keys(data)) {
      const snaps = data[fid];
      if (Array.isArray(snaps) && snaps.length && (oldest === null || snaps[0].at < oldest)) {
        oldest = snaps[0].at;
        oldestFile = fid;
        oldestIdx = 0;
      }
    }
    if (oldestFile === null) return false;
    data[oldestFile].splice(oldestIdx, 1);
    if (!data[oldestFile].length) delete data[oldestFile];
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      return true;
    } catch {
      return false;
    }
  }
}

function isQuotaError(e) {
  return (
    e &&
    (e.name === 'QuotaExceededError' ||
      e.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
      e.code === 22)
  );
}

export function recordSnapshot(fileId, content) {
  if (!fileId || typeof content !== 'string') return false;
  if (!content) return false; 
  if (content.length > MAX_CONTENT_CHARS) return false;
  try {
    const data = load();
    let snaps = data[fileId];
    if (!Array.isArray(snaps)) snaps = data[fileId] = [];
    const last = snaps[snaps.length - 1];
    if (last && last.content === content) return false; 
    snaps.push({ at: Date.now(), content });
    while (snaps.length > MAX_PER_FILE) snaps.shift();
    return persist();
  } catch {
    return false; 
  }
}

export function getSnapshots(fileId) {
  try {
    const data = load();
    const snaps = data[fileId];
    return Array.isArray(snaps) ? snaps.slice() : [];
  } catch {
    return [];
  }
}

export function clearHistory(fileId) {
  try {
    const data = load();
    delete data[fileId];
    persist();
  } catch {}
}

export function historyFileCount() {
  try {
    return Object.keys(load()).length;
  } catch {
    return 0;
  }
}


export function __resetCache() {
  cache = null;
}

export const LIMITS = { MAX_PER_FILE, MAX_CONTENT_CHARS };
