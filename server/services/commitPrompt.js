const MAX_COMMIT_DIFF_CHARS = 12000;
const MAX_COMMIT_FILES = 100;

function cleanCommitMessage(text) {
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

function buildCommitPrompt({ files, diff }) {
  const list = (Array.isArray(files) ? files : [])
    .map((f) => String(f || '').trim())
    .filter(Boolean)
    .slice(0, MAX_COMMIT_FILES);
  let diffText = String(diff || '');
  let truncated = false;
  if (diffText.length > MAX_COMMIT_DIFF_CHARS) {
    diffText = diffText.slice(0, MAX_COMMIT_DIFF_CHARS);
    truncated = true;
  }
  const parts = [
    'Write ONE git commit message for the changes below.',
    'Use Conventional Commits style:',
    '- First line: type(scope): summary, where type is one of feat, fix, refactor, chore, docs, style, test. Use the imperative mood and keep the first line at most 72 characters.',
    '- Then a blank line and up to 4 short bullet points starting with "- " covering only the notable changes, and only when the change is more than trivial.',
    'Output ONLY the commit message. No quotes, no code fences, no explanations.',
    '',
    `Changed files (${list.length}):`,
    ...(list.length ? list.map((f) => `- ${f}`) : ['- (unknown)']),
    '',
    'Diff:',
    diffText || '(no diff provided)',
  ];
  if (truncated) {
    parts.push('', '[diff truncated]');
  }
  return parts.join('\n');
}

module.exports = {
  buildCommitPrompt,
  cleanCommitMessage,
  MAX_COMMIT_DIFF_CHARS,
  MAX_COMMIT_FILES,
};
