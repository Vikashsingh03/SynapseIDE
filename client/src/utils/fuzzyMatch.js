const BOUNDARY_CHARS = new Set(['/', '\\', ' ', '-', '_', '.']);

export function fuzzyMatch(query, text) {
  const q = String(query ?? '').toLowerCase();
  const t = String(text ?? '');
  if (!q || !t) return null;
  const lower = t.toLowerCase();
  const indices = [];
  let from = 0;
  for (let i = 0; i < q.length; i++) {
    const idx = lower.indexOf(q[i], from);
    if (idx === -1) return null;
    indices.push(idx);
    from = idx + 1;
  }
  let score = indices.length * 10;
  if (indices[0] === 0) score += 40;
  for (let i = 0; i < indices.length; i++) {
    const idx = indices[i];
    if (idx > 0 && BOUNDARY_CHARS.has(t[idx - 1])) score += 15;
    if (i > 0) {
      const gap = idx - indices[i - 1] - 1;
      if (gap === 0) score += 12;
      else score -= Math.min(20, gap * 2);
    }
  }
  score -= Math.floor(t.length / 8);
  return { score, indices };
}

export function compareScored(a, b) {
  if (b.score !== a.score) return b.score - a.score;
  const la = String(a.text ?? '').length;
  const lb = String(b.text ?? '').length;
  if (la !== lb) return la - lb;
  return String(a.text ?? '').localeCompare(String(b.text ?? ''));
}
