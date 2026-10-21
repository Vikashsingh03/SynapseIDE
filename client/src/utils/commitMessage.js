export const MAX_COMMIT_DIFF_CHARS = 12000;
export const MAX_COMMIT_DIFF_FILES = 8;

export function cleanCommitMessage(text) {
  let out = String(text || '').replace(/\r\n/g, '\n').trim();
  if (!out) return '';
  if (out.startsWith('```') && out.endsWith('```') && out.length > 6) {
    out = out.slice(3, -3).replace(/^[A-Za-z0-9_-]+[ \t]*\n/, '').trim();
  }
  if (!out) return '';
  const first = out.charAt(0);
  const last = out.charAt(out.length - 1);
  if (
    out.length >= 2 &&
    ((first === '"' && last === '"') || (first === "'" && last === "'") || (first === '`' && last === '`'))
  ) {
    out = out.slice(1, -1).trim();
  }
  if (!out) return '';
  out = out
    .split('\n')
    .map((line) => line.replace(/[ \t]+$/, ''))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  if (!out) return '';
  const splitAt = out.indexOf('\n');
  const subject = splitAt === -1 ? out : out.slice(0, splitAt);
  if (subject.length > 100) {
    const capped = subject.slice(0, 100).replace(/[ \t]+$/, '');
    out = splitAt === -1 ? capped : capped + out.slice(splitAt);
  }
  return out;
}

export function assembleCommitDiff(perFileDiffs, totalFiles) {
  const entries = Array.isArray(perFileDiffs) ? perFileDiffs : [];
  const total = typeof totalFiles === 'number' ? totalFiles : entries.length;
  let truncated = total > entries.length;
  const parts = [];
  let used = 0;
  for (const entry of entries) {
    const file = String((entry && entry.file) || '').trim();
    const body = String((entry && entry.diff) || '');
    if (!file) continue;
    const header = `File: ${file}`;
    const section = `${header}\n${body}`;
    const sep = parts.length ? 2 : 0;
    if (used + sep + section.length <= MAX_COMMIT_DIFF_CHARS) {
      parts.push(section);
      used += sep + section.length;
    } else {
      const room = MAX_COMMIT_DIFF_CHARS - used - sep - header.length - 1;
      if (room > 0) {
        parts.push(`${header}\n${body.slice(0, room)}`);
        used = MAX_COMMIT_DIFF_CHARS;
      }
      truncated = true;
      break;
    }
  }
  return { diff: parts.join('\n\n'), truncated };
}
