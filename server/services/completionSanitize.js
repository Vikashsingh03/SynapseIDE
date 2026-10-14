/**
 * Pure helpers for ghost-text (inline completion) output.
 *
 * Zero imports — safe to unit test in plain node and reuse from any
 * provider transport.
 */

const MAX_COMPLETION_CHARS = 2000;

/**
 * Unwrap a markdown fence pair only when the WHOLE output is fenced,
 * e.g. "```js\ncode\n```" -> "code". Partial/inline fences are kept as-is.
 */
function stripWholeFence(text) {
  const lines = String(text).split('\n');
  if (lines.length >= 2 && lines[0].trim().startsWith('```')) {
    let end = lines.length - 1;
    // Ignore blank lines trailing the closing fence.
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

/**
 * Clean raw model output for inline ghost text.
 * - unwraps a whole-output markdown fence
 * - drops leading blank lines
 * - drops a duplicated first line that echoes the prefix's last line
 * - caps the output length
 *
 * @param {string} text   raw model output
 * @param {string} prefix code that sits before the cursor (for echo detection)
 */
function sanitizeCompletion(text, prefix = '') {
  let out = String(text || '');

  out = stripWholeFence(out);
  out = out.replace(/^(\s*\n)+/, '');

  // Models love echoing the line the cursor is on: if the first completion
  // line exactly matches the last non-empty prefix line, drop it.
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
