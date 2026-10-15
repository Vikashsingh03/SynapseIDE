















const LT_RE = /^<{7}(?:\s|$)/; 
const PIPE_RE = /^\|{7}(?:\s|$)/; 
const EQ_RE = /^={7}(?:\s|$)/; 
const GT_RE = /^>{7}(?:\s+(.*))?$/; 

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
        
        if (mode !== 'current' || base !== null) break;
        base = [];
        mode = 'base';
        j += 1;
        continue;
      }

      if (EQ_RE.test(line)) {
        
        if (mode === 'incoming') break; 
        mode = 'incoming';
        j += 1;
        continue;
      }

      const end = line.match(GT_RE);
      if (end) {
        
        if (mode !== 'incoming') break;
        incomingLabel = (end[1] || '').trim();
        closed = true;
        endLine = j + 1; 
        j += 1;
        break;
      }

      if (LT_RE.test(line)) break; 

      (mode === 'current' ? current : mode === 'base' ? base : incoming).push(line);
      j += 1;
    }

    if (!closed) {
      
      
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
  let cursor = 0; 

  for (const hunk of parsed.hunks) {
    const choice = choices ? choices[hunk.index] : undefined;
    const s = hunk.startLine - 1; 
    const e = hunk.endLine; 

    out.push(...lines.slice(cursor, s));
    if (choice === 'current') {
      out.push(...hunk.current);
    } else if (choice === 'incoming') {
      out.push(...hunk.incoming);
    } else if (choice === 'both') {
      out.push(...hunk.current, ...hunk.incoming);
    } else {
      out.push(...lines.slice(s, e)); 
    }
    cursor = e;
  }
  out.push(...lines.slice(cursor));
  return out.join('\n');
}
