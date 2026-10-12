/**
 * Renders the active file's code as a beautiful shareable PNG image
 * (gradient backdrop + editor card + syntax highlighting) using canvas.
 * Zero external dependencies.
 */

const FONT = '14px "JetBrains Mono", Menlo, Consolas, "Courier New", monospace';
const LINE_HEIGHT = 24;
const PAD = 44;
const HEADER_H = 56;

const C = {
  base: '#d6deeb',
  muted: '#5b6b8c',
  comment: '#637777',
  string: '#ecc48d',
  keyword: '#c792ea',
  number: '#f78c6c',
  cardBorder: 'rgba(255,255,255,0.10)',
};

const KEYWORDS = new Set(
  'break case catch class const continue debugger default delete do else export extends finally for function if import in instanceof new return super switch this throw try typeof var void while with yield async await static get set of from as let def lambda pass raise except print None True False null true false self'.split(' ')
);

function tokenizeLine(line) {
  const tokens = [];
  const re = /(\/\/.*$|#.*$)|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)|\b(\d+(?:\.\d+)?)\b|\b([A-Za-z_]\w*)\b/g;
  let last = 0;
  let m;
  while ((m = re.exec(line)) !== null) {
    if (m.index > last) tokens.push({ text: line.slice(last, m.index), color: C.base, italic: false });
    if (m[1]) tokens.push({ text: m[1], color: C.comment, italic: true });
    else if (m[2]) tokens.push({ text: m[2], color: C.string, italic: false });
    else if (m[3]) tokens.push({ text: m[3], color: C.number, italic: false });
    else if (m[4]) tokens.push({ text: m[4], color: KEYWORDS.has(m[4]) ? C.keyword : C.base, italic: false });
    last = m.index + m[0].length;
    if (m[0].length === 0) break;
  }
  if (last < line.length) tokens.push({ text: line.slice(last), color: C.base, italic: false });
  return tokens.length ? tokens : [{ text: ' ', color: C.base, italic: false }];
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/**
 * @param {{ code: string, filename: string }} opts
 * @returns {Promise<void>} downloads a PNG snapshot
 */
export async function exportCodeSnapshot({ code = '', filename = 'code.txt' } = {}) {
  const lines = String(code).split('\n');
  const scale = 2;

  // Measure the widest line so the card fits the code
  const measureCanvas = document.createElement('canvas');
  const mctx = measureCanvas.getContext('2d');
  mctx.font = FONT;
  let maxLineWidth = 0;
  for (const line of lines) {
    const w = mctx.measureText(line.replace(/\t/g, '    ')).width;
    if (w > maxLineWidth) maxLineWidth = w;
  }
  const gutterW = 52;
  const cardW = Math.min(1700, Math.max(860, PAD * 2 + gutterW + maxLineWidth));
  const cardH = HEADER_H + lines.length * LINE_HEIGHT + PAD;
  const W = cardW + PAD * 2.4;
  const H = cardH + PAD * 2.4;

  const canvas = document.createElement('canvas');
  canvas.width = Math.round(W * scale);
  canvas.height = Math.round(H * scale);
  const ctx = canvas.getContext('2d');
  ctx.scale(scale, scale);

  // Backdrop gradient
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, '#1e1b4b');
  bg.addColorStop(0.45, '#312e81');
  bg.addColorStop(1, '#0f0c29');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Soft glow blobs
  const glow = (x, y, r, color) => {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, color);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  };
  glow(W * 0.15, H * 0.2, 260, 'rgba(139,92,246,0.35)');
  glow(W * 0.85, H * 0.8, 300, 'rgba(34,211,238,0.22)');

  // Editor card
  const cardX = PAD * 1.2;
  const cardY = PAD * 1.2;
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.5)';
  ctx.shadowBlur = 48;
  ctx.shadowOffsetY = 18;
  roundRect(ctx, cardX, cardY, cardW, cardH, 18);
  ctx.fillStyle = 'rgba(10,12,24,0.94)';
  ctx.fill();
  ctx.restore();
  roundRect(ctx, cardX, cardY, cardW, cardH, 18);
  ctx.strokeStyle = C.cardBorder;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Header: traffic dots + filename
  const dots = ['#ff5f57', '#febc2e', '#28c840'];
  dots.forEach((color, i) => {
    ctx.beginPath();
    ctx.arc(cardX + 28 + i * 22, cardY + 28, 7, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  });
  ctx.fillStyle = C.muted;
  ctx.font = '13px Inter, system-ui, sans-serif';
  ctx.textBaseline = 'middle';
  ctx.fillText(filename, cardX + 96, cardY + 29);

  // Divider
  ctx.strokeStyle = 'rgba(255,255,255,0.07)';
  ctx.beginPath();
  ctx.moveTo(cardX, cardY + HEADER_H);
  ctx.lineTo(cardX + cardW, cardY + HEADER_H);
  ctx.stroke();

  // Code lines
  ctx.font = FONT;
  const codeTop = cardY + HEADER_H + PAD / 2;
  lines.forEach((rawLine, i) => {
    const y = codeTop + i * LINE_HEIGHT + LINE_HEIGHT / 2;
    const line = rawLine.replace(/\t/g, '    ');
    // Line number
    ctx.fillStyle = C.muted;
    ctx.textAlign = 'right';
    ctx.fillText(String(i + 1), cardX + PAD + gutterW - 14, y);
    // Tokens
    ctx.textAlign = 'left';
    let x = cardX + PAD + gutterW;
    for (const tok of tokenizeLine(line)) {
      ctx.fillStyle = tok.color;
      ctx.font = tok.italic ? `italic ${FONT}` : FONT;
      ctx.fillText(tok.text, x, y);
      x += ctx.measureText(tok.text).width;
    }
  });
  ctx.font = FONT;

  // Watermark
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.font = '12px Inter, system-ui, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText('Made with Synapse', cardX + cardW - 20, cardY + cardH - 18);

  // Download
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('Could not render snapshot.');
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename.replace(/\.[^.]+$/, '') || 'code'}-snapshot.png`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
