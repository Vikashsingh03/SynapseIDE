import { diffLines } from './simpleDiff.js';

export const CHANGE_KIND_CLASSES = {
  added: 'synapse-change-added',
  modified: 'synapse-change-modified',
  deleted: 'synapse-change-deleted',
};

const MAX_LINES = 6000;

const baselines = new Map();

export function setBaseline(fileId, content) {
  baselines.set(fileId, content);
}

export function getBaseline(fileId) {
  return baselines.get(fileId);
}

export function hasBaseline(fileId) {
  return baselines.has(fileId);
}

export function clearBaseline(fileId) {
  baselines.delete(fileId);
}

export function clearAllBaselines() {
  baselines.clear();
}

export function computeLineChanges(baselineText, currentText) {
  const base = String(baselineText ?? '');
  const current = String(currentText ?? '');
  if (current === '') return [];
  if (base === current) return [];
  const baseLines = base.split('\n');
  const currentLines = current.split('\n');
  if (baseLines.length > MAX_LINES || currentLines.length > MAX_LINES) return [];
  if (base === '') {
    return currentLines.map((_, idx) => ({ line: idx + 1, kind: 'added' }));
  }
  const ops = diffLines(base, current);
  if (!ops) return [];
  const changes = [];
  let line = 1;
  let idx = 0;
  while (idx < ops.length) {
    if (ops[idx].type === 'same') {
      line++;
      idx++;
      continue;
    }
    let dels = 0;
    const adds = [];
    while (idx < ops.length && ops[idx].type !== 'same') {
      if (ops[idx].type === 'del') {
        dels++;
      } else {
        adds.push(line);
        line++;
      }
      idx++;
    }
    if (dels > 0 && adds.length === 0) {
      changes.push({ line: Math.min(line, currentLines.length), kind: 'deleted' });
    } else {
      const overlap = Math.min(dels, adds.length);
      for (let k = 0; k < adds.length; k++) {
        changes.push({ line: adds[k], kind: k < overlap ? 'modified' : 'added' });
      }
    }
  }
  return changes;
}
