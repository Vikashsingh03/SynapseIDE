// client/src/utils/gitConflicts.js
// Pure merge-conflict helpers for the GitPanel resolver. No imports.
// Supports standard conflict markers plus optional diff3 base sections.
//
// parseConflicts(content) →
//   { hasConflicts, hunks: [{ index, startLine (1-based, the <<<<<<< line),
//                              endLine (1-based, the >>>>>>> line),
//                              currentLabel, incomingLabel,
//                              current: [lines], base: [lines] | null, incoming: [lines] }] }
// Malformed or unterminated hunks stop parsing gracefully: the offending hunk
// is dropped and everything from its <<<<<<< onward is treated as plain text.
//
// applyResolutions(content, choices) where choices = { [hunkIndex]: 'current' | 'incoming' | 'both' }
// → resolved string. 'both' = current lines then incoming lines.
// Hunks without a choice are left as-is (markers preserved).

const LT_RE = /^<{7}(?:\s|$)/; // <<<<<<<
const PIPE_RE = /^\|{7}(?:\s|$)/; // ||||||| (diff3 base)
const EQ_RE = /^={7}(?:\s|$)/; // =======
const GT_RE = /^>{7}(?:\s+(.*))?$/; // >>>>>>>

export function parseConflicts(content) {
  const lines = String(content == null ? '' : content).split('\n');
  const hunks = [];

  let i = 0;
  while (i < lines.length) {
    const start = lines[i].match(/^<{7}(?:\s+(.*))?$/);
    if (!start) {
      i += 1;
      continue;
    }

    const currentLabel = (start[1] || '').trim();
    const current = [];
    let base = null;
    const incoming = [];
    let incomingLabel = '';

    let mode = 'current';
    let j = i + 1;
    let closed = false;
    let endLine = null;

    while (j < lines.length) {
      const line = lines[j];

      if (PIPE_RE.test(line)) {
        // diff3 base separator — only valid once, right after the current side
        if (mode !== 'current' || base !== null) break;
        base = [];
        mode = 'base';
        j += 1;
        continue;
      }

      if (EQ_RE.test(line)) {
        // separator between base/current and incoming
        if (mode === 'incoming') break; // second ======= → malformed
        mode = 'incoming';
        j += 1;
        continue;
      }

      const end = line.match(GT_RE);
      if (end) {
        // end marker — only valid after the incoming side started
        if (mode !== 'incoming') break;
        incomingLabel = (end[1] || '').trim();
        closed = true;
        endLine = j + 1; // 1-based
        j += 1;
        break;
      }

      if (LT_RE.test(line)) break; // nested <<<<<<< → malformed

      (mode === 'current' ? current : mode === 'base' ? base : incoming).push(line);
      j += 1;
    }

    if (!closed) {
      // Malformed / unterminated hunk: drop it and stop parsing —
      // the rest of the file is treated as plain text.
      break;
    }

    hunks.push({
      index: hunks.length,
      startLine: i + 1,
      endLine,
      currentLabel,
      incomingLabel,
      current,
      base,
      incoming,
    });
    i = j;
  }

  return { hasConflicts: hunks.length > 0, hunks };
}

export function applyResolutions(content, choices) {
  const parsed = parseConflicts(content);
  if (!parsed.hasConflicts) return String(content == null ? '' : content);

  const lines = String(content).split('\n');
  const out = [];
  let cursor = 0; // 0-based line index already emitted

  for (const hunk of parsed.hunks) {
    const choice = choices ? choices[hunk.index] : undefined;
    const s = hunk.startLine - 1; // inclusive, 0-based
    const e = hunk.endLine; // exclusive, 0-based (endLine is 1-based)

    out.push(...lines.slice(cursor, s));
    if (choice === 'current') {
      out.push(...hunk.current);
    } else if (choice === 'incoming') {
      out.push(...hunk.incoming);
    } else if (choice === 'both') {
      out.push(...hunk.current, ...hunk.incoming);
    } else {
      out.push(...lines.slice(s, e)); // no choice → keep markers as-is
    }
    cursor = e;
  }
  out.push(...lines.slice(cursor));
  return out.join('\n');
}
