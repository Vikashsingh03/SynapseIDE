// neuraFix — 'Fix with Neura' helpers for the Problems panel.
// Pure module: no imports. Builds the agent-mode prompt sent to Neura for a
// single problem. The reply is parsed server-side by
// server/services/agentActions.js (```neura-action fenced blocks; types:
// create_file | replace_file | insert_code).

export const MAX_FULL_LINES = 400;
export const MAX_FULL_CHARS = 20000;
export const CONTEXT_RADIUS = 6;

/**
 * ±radius line window around a 1-based line number, with line numbers and a
 * '→' marker on the error line. Clamps at file start/end.
 */
export function extractContextWindow(content, line, radius = CONTEXT_RADIUS) {
  const lines = String(content || '').split('\n');
  const total = lines.length;
  const idx = Math.min(Math.max(Number(line) || 1, 1), Math.max(total, 1)) - 1;
  const start = Math.max(0, idx - radius);
  const end = Math.min(total, idx + radius + 1);
  const width = String(end).length;
  const out = [];
  for (let i = start; i < end; i++) {
    const num = String(i + 1).padStart(width, ' ');
    const marker = i === idx ? '→' : ' ';
    out.push(`${marker} ${num} | ${lines[i]}`);
  }
  return { window: out.join('\n'), firstLine: start + 1, lastLine: end, totalLines: total };
}

function languageOf(fileName) {
  const base = String(fileName || '').split('/').pop();
  const dot = base.lastIndexOf('.');
  const ext = dot > 0 ? base.slice(dot + 1).toLowerCase() : '';
  const map = {
    js: 'javascript', mjs: 'javascript', cjs: 'javascript',
    jsx: 'javascript', ts: 'typescript', tsx: 'typescript',
    mts: 'typescript', cts: 'typescript', json: 'json',
    css: 'css', scss: 'scss', html: 'html', py: 'python',
    md: 'markdown', sql: 'sql', java: 'java', cpp: 'cpp', c: 'c',
  };
  return map[ext] || '';
}

/**
 * Build the agent-mode prompt for one problem.
 * Small files: full content in a fenced block (agent can emit replace_file).
 * Large files (>400 lines or >20k chars): ±6-line numbered window instead,
 * and the model is told NOT to emit replace_file (it can't see the whole
 * file — same rule the agent schema itself enforces).
 */
export function buildFixPrompt({ fileName, relPath, line, column, message, fileContent }) {
  const path = relPath || fileName || 'unknown';
  const lineCount = String(fileContent || '').split('\n').length;
  const charCount = String(fileContent || '').length;
  const useWindow = lineCount > MAX_FULL_LINES || charCount > MAX_FULL_CHARS;
  const lang = languageOf(fileName);
  const fence = lang ? `\`\`\`${lang}` : '```';

  let contextSection;
  if (useWindow) {
    const { window, firstLine, lastLine, totalLines } = extractContextWindow(fileContent, line);
    contextSection = [
      `NOTE: this is only lines ${firstLine}–${lastLine} of the file (the file has ${totalLines} lines).`,
      'You do NOT have the full file, so you must NOT emit a ```neura-action block.',
      'Instead describe the precise fix in chat: the exact line number and the corrected code in a normal fenced block.',
      '',
      '```',
      window,
      '```',
    ].join('\n');
  } else {
    contextSection = ['The file content:', '', fence, String(fileContent || ''), '```'].join('\n');
  }

  const fixInstruction = useWindow
    ? 'Fix this problem by describing the precise fix in chat (exact line number + corrected code). Do NOT emit a ```neura-action block — you cannot see the full file.'
    : [
        'Reply with ONE ```neura-action fenced block using type "replace_file":',
        '',
        '```neura-action',
        `{ "type": "replace_file", "path": "${path}", "content": "<FULL corrected file content>" }`,
        '```',
        '',
        `- The "path" must be exactly "${path}" (project-relative, no leading slash).`,
        '- "content" must be the ENTIRE fixed file, not a diff.',
      ].join('\n');

  return [
    'Fix this problem in my project. Project paths are relative to the project root.',
    '',
    'Problem:',
    `- File: ${path}`,
    `- Line: ${line || 1}${column ? `, Column: ${column}` : ''}`,
    `- Error: ${message || '(no message)'}`,
    '',
    contextSection,
    '',
    'Instructions:',
    '- Make the SMALLEST change that fixes exactly this error. Do not reformat or change anything unrelated.',
    `- ${fixInstruction.replace(/\n/g, '\n  ').trim()}`,
    '- Keep your chat text to one short sentence; the fix must live in the action block.',
  ].join('\n');
}
