// Neura Agent Mode — action block extraction + validation.
// Pure module: no imports. Runs on the server after the model reply is
// complete, before the reply is persisted/returned.
//
// Agent-mode replies may carry fenced blocks:
//
//   ```neura-action
//   { "type": "create_file", "path": "src/util.js", "content": "..." }
//   ```
//
// Types: create_file | replace_file (FULL new file content) | insert_code
// (needs afterLine, 1-based; 0 = top of file).

const ACTION_FENCE_RE = /```neura-action[ \t]*\r?\n([\s\S]*?)```/g;

const ACTION_TYPES = new Set(['create_file', 'replace_file', 'insert_code']);

const MAX_ACTIONS = 6;
const MAX_PATH_LENGTH = 200;
const MAX_CONTENT_LENGTH = 100000;

function sanitizePath(raw) {
  if (typeof raw !== 'string') return null;
  let p = raw.trim();
  if (!p) return null;
  // Strip Windows drive letters (C:\ / C:/) and leading slashes.
  p = p.replace(/^[A-Za-z]:[\\/]?/, '').replace(/^[/\\]+/, '');
  const segments = p.split(/[/\\]+/).filter((s) => s && s !== '.');
  if (!segments.length) return null;
  // Path traversal is not negotiable — the whole action is dropped.
  if (segments.some((s) => s === '..')) return null;
  const normalized = segments.join('/');
  if (normalized.length > MAX_PATH_LENGTH) return null;
  return normalized;
}

function sanitizeAction(raw) {
  if (!raw || typeof raw !== 'object') return null;

  const type = raw.type;
  if (!ACTION_TYPES.has(type)) return null;

  const path = sanitizePath(raw.path);
  if (!path) return null;

  if (typeof raw.content !== 'string') return null;
  // Oversized content: drop the action rather than truncate (a truncated
  // file write would silently corrupt the user's code).
  if (raw.content.length > MAX_CONTENT_LENGTH) return null;

  const action = { type, path, content: raw.content };

  if (type === 'insert_code') {
    const afterLine = Number(raw.afterLine);
    if (!Number.isInteger(afterLine) || afterLine < 0) return null;
    action.afterLine = afterLine;
  }

  return action;
}

function extractAgentActions(text) {
  const source = String(text || '');
  const actions = [];

  ACTION_FENCE_RE.lastIndex = 0;
  let match;
  while ((match = ACTION_FENCE_RE.exec(source)) !== null) {
    if (actions.length >= MAX_ACTIONS) break;
    let parsed = null;
    try {
      parsed = JSON.parse(match[1]);
    } catch {
      parsed = null; // invalid JSON → skipped silently
    }
    const action = sanitizeAction(parsed);
    if (action) actions.push(action);
  }

  // Strip the blocks from the chat text; tidy up the leftover whitespace.
  ACTION_FENCE_RE.lastIndex = 0;
  let cleanText = source.replace(ACTION_FENCE_RE, '');
  cleanText = cleanText
    .split('\n')
    .map((line) => (line.trim() === '```' ? '' : line))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return { cleanText, actions };
}

const AGENT_SYSTEM_SUFFIX = [
  'AGENT MODE — FILE ACTIONS',
  'You may propose concrete file changes. Each proposed change is ONE fenced block, exactly like this (the fence language must be neura-action):',
  '',
  '```neura-action',
  '{ "type": "create_file", "path": "src/utils/helpers.js", "content": "// full file content here" }',
  '```',
  '',
  'Rules:',
  '- Action types: "create_file" (new file; parent folders are created automatically), "replace_file" (replaces the ENTIRE file — you must output the FULL new file content, never a diff), "insert_code" (inserts content AFTER a line; add "afterLine" as a 1-based line number — 0 means the very top of the file).',
  '- One JSON object per fenced block. Only JSON inside the fence — no comments, no trailing commas.',
  '- Paths are relative to the project root, e.g. "src/app.js" (never "/src/app.js"). Maximum 6 actions per reply.',
  '- You can see the currently open file (its name and FULL content) plus the names of all workspace files. Only propose replace_file or insert_code for files whose full content you have actually seen (the open file, or content the user pasted in chat). Never invent a file\u2019s contents. If the user wants a change to a file you cannot see, ask them to open it first.',
  '- Keep your chat text short and plain. Every file change must be an action block so the user can review and approve it — never bury file contents in ordinary code fences.',
].join('\n');

module.exports = {
  extractAgentActions,
  AGENT_SYSTEM_SUFFIX,
  // exposed for tests
  _sanitizePath: sanitizePath,
  _sanitizeAction: sanitizeAction,
};
