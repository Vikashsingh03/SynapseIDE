import { MAX_FULL_LINES, MAX_FULL_CHARS } from './neuraFix';

export const SELECTION_CONTEXT_RADIUS = 10;

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

function clampRange(startLine, endLine, totalLines) {
  const total = Math.max(totalLines || 1, 1);
  let start = Math.min(Math.max(Number(startLine) || 1, 1), total);
  let end = Math.min(Math.max(Number(endLine) || start, 1), total);
  if (end < start) {
    const swap = start;
    start = end;
    end = swap;
  }
  return { start, end };
}

export function buildRangeWindow(content, startLine, endLine, radius = SELECTION_CONTEXT_RADIUS) {
  const lines = String(content || '').split('\n');
  const total = lines.length;
  const { start, end } = clampRange(startLine, endLine, total);
  const firstLine = Math.max(1, start - radius);
  const lastLine = Math.min(total, end + radius);
  const width = String(lastLine).length;
  const out = [];
  for (let n = firstLine; n <= lastLine; n++) {
    const num = String(n).padStart(width, ' ');
    const marker = n >= start && n <= end ? '→' : ' ';
    out.push(`${marker} ${num} | ${lines[n - 1]}`);
  }
  return { window: out.join('\n'), firstLine, lastLine, totalLines: total };
}

export function buildExplainSelectionPrompt({ fileName, startLine, endLine, selectionText }) {
  const lang = languageOf(fileName);
  const fence = lang ? `\`\`\`${lang}` : '```';
  return [
    'Explain this selected code from my project. Answer in chat only — do not propose file changes.',
    '',
    `File: ${fileName || 'unknown'}`,
    `Lines: ${startLine || 1}–${endLine || startLine || 1}`,
    '',
    fence,
    String(selectionText || ''),
    '```',
    '',
    'In your explanation:',
    '- Say what this code does, in plain simple words.',
    '- Walk through the tricky parts line by line.',
    '- Point out any bug smells, edge cases, or risky spots you notice — or say it looks clean if there are none.',
  ].join('\n');
}

export function buildSelectionTaskPrompt({ kind, fileName, relPath, startLine, endLine, selectionText, fileContent }) {
  const isRefactor = kind === 'refactor';
  const path = relPath || fileName || 'unknown';
  const content = String(fileContent || '');
  const lines = content.split('\n');
  const lineCount = lines.length;
  const charCount = content.length;
  const isSmall = lineCount <= MAX_FULL_LINES && charCount <= MAX_FULL_CHARS;
  const { start, end } = clampRange(startLine, endLine, lineCount);
  const lang = languageOf(fileName);
  const fence = lang ? `\`\`\`${lang}` : '```';

  const selectionSection = [
    'The selected code:',
    '',
    fence,
    String(selectionText || ''),
    '```',
  ];

  const verb = isRefactor ? 'Refactor the selected code' : 'Fix the problem in the selected code';
  const head = [
    `${verb} in my project. Project paths are relative to the project root.`,
    '',
    `File: ${path}`,
    `Selected lines: ${start}–${end}`,
    '',
    ...selectionSection,
    '',
  ];

  if (!isSmall) {
    const { window, firstLine, lastLine, totalLines } = buildRangeWindow(content, start, end);
    return [
      ...head,
      `Context (lines ${firstLine}–${lastLine} of ${totalLines}; the selected lines are marked with →):`,
      '',
      '```',
      window,
      '```',
      '',
      'Instructions:',
      `- You do NOT have the full file, so you must NOT emit a \`\`\`neura-action block.`,
      `- In chat, give the exact replacement code for lines ${start}–${end} only, in a normal fenced block, plus one short sentence on what changed and why.`,
      isRefactor
        ? '- The replacement must keep the exact same behavior as the selected code — readability and structure only.'
        : '- The replacement must fix the problem in the selected lines and nothing else.',
    ].join('\n');
  }

  const taskInstructions = isRefactor
    ? [
        '- Improve the readability and structure of ONLY the selected region. Do NOT change behavior: same inputs, same outputs, same side effects.',
        '- Keep the same function/variable names and signatures unless a rename is clearly better and stays inside the selected region.',
        '- Do not reformat or touch anything outside the selected lines.',
      ]
    : [
        '- Make the SMALLEST change that fixes the problem in the selected region.',
        '- Do not reformat or change anything unrelated.',
      ];

  return [
    ...head,
    'The full file content:',
    '',
    fence,
    content,
    '```',
    '',
    'Instructions:',
    `- Change ONLY the selected region (lines ${start}–${end}). Every other line of the file must stay byte-identical.`,
    ...taskInstructions,
    '- Reply with ONE ```neura-action fenced block using type "replace_file":',
    '',
    '```neura-action',
    `{ "type": "replace_file", "path": "${path}", "content": "<FULL corrected file content>" }`,
    '```',
    '',
    `- The "path" must be exactly "${path}" (project-relative, no leading slash).`,
    '- "content" must be the ENTIRE file with only the selected region changed, not a diff.',
    '- Keep your chat text to one short sentence; the change must live in the action block.',
  ].join('\n');
}
