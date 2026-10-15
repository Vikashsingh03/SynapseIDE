









const HEADER_MIN_WIDTH = 3;

function splitCells(line) {
  
  let s = line.trim();
  if (s.startsWith('|')) s = s.slice(1);
  if (s.endsWith('|')) s = s.slice(0, -1);
  return s.split('|').map((c) => c.trim());
}

function isSeparatorCell(cell) {
  
  return /^:?-+:?$/.test(cell) && cell.includes('-');
}

function isSeparatorLine(line) {
  const cells = splitCells(line);
  return cells.length > 0 && cells.every(isSeparatorCell);
}

function alignmentOf(cell) {
  const left = cell.startsWith(':');
  const right = cell.endsWith(':');
  if (left && right) return 'center';
  if (left) return 'left';
  if (right) return 'right';
  return 'none';
}

function separatorFor(width, align) {
  if (width < HEADER_MIN_WIDTH) width = HEADER_MIN_WIDTH;
  switch (align) {
    case 'left':
      return ':' + '-'.repeat(width - 1);
    case 'right':
      return '-'.repeat(width - 1) + ':';
    case 'center':
      return ':' + '-'.repeat(width - 2) + ':';
    default:
      return '-'.repeat(width);
  }
}

function renderRow(cells, widths) {
  const padded = widths.map((w, i) => (cells[i] ?? '').padEnd(w, ' '));
  return `| ${padded.join(' | ')} |`;
}





export function formatMarkdownTables(text) {
  const lines = String(text ?? '').split('\n');
  const out = [];
  let count = 0;
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const next = i + 1 < lines.length ? lines[i + 1] : null;
    const looksLikeTable =
      line.trim().startsWith('|') &&
      next !== null &&
      next.trim().startsWith('|') &&
      isSeparatorLine(next);

    if (!looksLikeTable) {
      out.push(line);
      i += 1;
      continue;
    }

    
    const header = splitCells(line);
    const sepCells = splitCells(next);
    const body = [];
    let j = i + 2;
    while (j < lines.length && lines[j].trim().startsWith('|') && !isSeparatorLine(lines[j])) {
      body.push(splitCells(lines[j]));
      j += 1;
    }
    
    
    const nCols = Math.max(header.length, sepCells.length, ...body.map((r) => r.length));
    const widths = [];
    for (let c = 0; c < nCols; c += 1) {
      let w = HEADER_MIN_WIDTH;
      const all = [header, ...body];
      for (const row of all) {
        const len = (row[c] ?? '').length;
        if (len > w) w = len;
      }
      widths.push(w);
    }
    const aligns = [];
    for (let c = 0; c < nCols; c += 1) aligns.push(alignmentOf(sepCells[c] ?? '---'));

    out.push(renderRow(header, widths));
    out.push(
      `| ${widths.map((w, c) => separatorFor(w, aligns[c])).join(' | ')} |`
    );
    for (const row of body) out.push(renderRow(row, widths));
    count += 1;
    i = j;
  }

  return { text: out.join('\n'), count };
}
