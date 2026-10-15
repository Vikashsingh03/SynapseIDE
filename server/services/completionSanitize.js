






const MAX_COMPLETION_CHARS = 2000;





function stripWholeFence(text) {
  const lines = String(text).split('\n');
  if (lines.length >= 2 && lines[0].trim().startsWith('```')) {
    let end = lines.length - 1;
    
    while (end > 0 && lines[end].trim() === '') end -= 1;
    if (end > 0 && lines[end].trim() === '```') {
      return lines.slice(1, end).join('\n');
    }
  }
  return text;
}

function lastNonEmptyLine(text) {
  const lines = String(text).split('\n');
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    if (lines[i].trim() !== '') return lines[i];
  }
  return null;
}











function sanitizeCompletion(text, prefix = '') {
  let out = String(text || '');

  out = stripWholeFence(out);
  out = out.replace(/^(\s*\n)+/, '');

  
  
  const echoLine = lastNonEmptyLine(prefix);
  if (echoLine) {
    const firstNl = out.indexOf('\n');
    const firstLine = firstNl === -1 ? out : out.slice(0, firstNl);
    if (firstLine === echoLine) {
      out = firstNl === -1 ? '' : out.slice(firstNl + 1);
      out = out.replace(/^(\s*\n)+/, '');
    }
  }

  if (out.trim() === '') return '';

  if (out.length > MAX_COMPLETION_CHARS) {
    out = out.slice(0, MAX_COMPLETION_CHARS);
  }

  return out;
}

module.exports = { sanitizeCompletion, stripWholeFence, MAX_COMPLETION_CHARS };
