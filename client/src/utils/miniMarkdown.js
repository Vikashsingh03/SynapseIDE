











const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };



const PS = '\uE000';
const PE = '\uE001';

export function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (ch) => ESCAPES[ch]);
}

const FENCE_RE = /^```[^\n]*\n([\s\S]*?)^```[ \t]*$/m;

export function renderMarkdown(md) {
  const fences = []; 
  const spans = [];  
  const fenceOf = (i) => `${PS}FENCE${i}${PE}`;
  const spanOf = (i) => `${PS}SPAN${i}${PE}`;

  
  let text = String(md);
  let m = FENCE_RE.exec(text);
  while (m) {
    const code = m[1].replace(/\n$/, ''); 
    fences.push(`<pre><code>${escapeHtml(code)}</code></pre>`);
    text = text.slice(0, m.index) + `\n${fenceOf(fences.length - 1)}\n` + text.slice(m.index + m[0].length);
    m = FENCE_RE.exec(text);
  }

  
  text = escapeHtml(text);

  
  text = text.replace(/`([^`\n]+?)`/g, (full, code) => {
    spans.push(`<code>${code}</code>`);
    return spanOf(spans.length - 1);
  });

  
  const lines = text.split('\n');
  const blocks = [];
  let i = 0;
  const fenceLineRe = new RegExp(`^${PS}FENCE(\\d+)${PE}$`);
  const flushPara = (acc) => {
    if (acc.length) blocks.push({ kind: 'p', text: acc.join(' ') });
    return [];
  };

  let para = [];
  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    const fm = trimmed.match(fenceLineRe);
    if (fm) {
      para = flushPara(para);
      blocks.push({ kind: 'fence', idx: Number(fm[1]) });
      i++;
      continue;
    }
    if (/^\s*$/.test(line)) {
      para = flushPara(para);
      i++;
      continue;
    }
    const hm = line.match(/^(#{1,3})\s+(.*)$/);
    if (hm) {
      para = flushPara(para);
      blocks.push({ kind: 'h', level: hm[1].length, text: hm[2].trim() });
      i++;
      continue;
    }
    if (/^\s*---+\s*$/.test(line)) {
      para = flushPara(para);
      blocks.push({ kind: 'hr' });
      i++;
      continue;
    }
    
    if (/^&gt;/.test(line)) {
      para = flushPara(para);
      const quotes = [];
      while (i < lines.length && /^&gt;/.test(lines[i])) {
        quotes.push(lines[i].replace(/^&gt;\s?/, ''));
        i++;
      }
      blocks.push({ kind: 'quote', text: quotes.join(' ') });
      continue;
    }
    if (/^\s*[-*]\s+/.test(line)) {
      para = flushPara(para);
      const items = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*]\s+/, ''));
        i++;
      }
      blocks.push({ kind: 'ul', items });
      continue;
    }
    if (/^\s*\d+\.\s+/.test(line)) {
      para = flushPara(para);
      const items = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+\.\s+/, ''));
        i++;
      }
      blocks.push({ kind: 'ol', items });
      continue;
    }
    para.push(trimmed);
    i++;
  }
  flushPara(para);

  
  const inline = (s) =>
    s
      .replace(/\*\*([^*]+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*([^*\n]+?)\*/g, '<em>$1</em>')
      
      .replace(
        /\[([^\]]*?)\]\((https?:\/\/[^\s)]+)\)/g,
        '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>'
      );

  const html = blocks
    .map((b) => {
      switch (b.kind) {
        case 'h':
          return `<h${b.level}>${inline(b.text)}</h${b.level}>`;
        case 'hr':
          return '<hr/>';
        case 'quote':
          return `<blockquote>${inline(b.text)}</blockquote>`;
        case 'ul':
          return `<ul>${b.items.map((it) => `<li>${inline(it)}</li>`).join('')}</ul>`;
        case 'ol':
          return `<ol>${b.items.map((it) => `<li>${inline(it)}</li>`).join('')}</ol>`;
        case 'p':
          return `<p>${inline(b.text)}</p>`;
        case 'fence':
          return fenceOf(b.idx);
        default:
          return '';
      }
    })
    .join('\n');

  
  return html
    .replace(new RegExp(`${PS}FENCE(\\d+)${PE}`, 'g'), (_, n) => fences[Number(n)])
    .replace(new RegExp(`${PS}SPAN(\\d+)${PE}`, 'g'), (_, n) => spans[Number(n)]);
}
