/**
 * launchConfig.js — pure parsers for `.synapse/launch.json` (launch configs)
 * and `tasks.json` (named terminal tasks). VS Code's format is JSONC, so we
 * strip // and /* * / comments (respecting strings) and trailing commas
 * before parsing. Zero imports — fully unit-testable in node.
 */

/** Workspace-relative path for a file, via its parentId folder chain. */
export function relPathOf(file, files) {
  const byId = new Map(files.map((f) => [f.id, f]));
  const parts = [file.name];
  const seen = new Set([file.id]);
  let cur = file;
  while (cur.parentId && byId.has(cur.parentId) && !seen.has(cur.parentId)) {
    seen.add(cur.parentId);
    cur = byId.get(cur.parentId);
    parts.unshift(cur.name);
  }
  return parts.join('/');
}

/**
 * Strip // line comments, /* block comments * /, and trailing commas from a
 * JSONC string. String literals (single, double, and backtick-quoted content
 * is never valid JSON but we still protect it) are left untouched.
 */
export function stripJsonc(text) {
  let out = '';
  let i = 0;
  const n = text.length;
  let inStr = null; // '"', "'"
  while (i < n) {
    const ch = text[i];
    if (inStr) {
      out += ch;
      if (ch === '\\' && i + 1 < n) {
        out += text[i + 1];
        i += 2;
        continue;
      }
      if (ch === inStr) inStr = null;
      i++;
      continue;
    }
    if (ch === '"' || ch === "'") {
      inStr = ch;
      out += ch;
      i++;
      continue;
    }
    if (ch === '/' && i + 1 < n && text[i + 1] === '/') {
      // line comment — skip to (not including) the newline
      while (i < n && text[i] !== '\n') i++;
      continue;
    }
    if (ch === '/' && i + 1 < n && text[i + 1] === '*') {
      // block comment
      i += 2;
      while (i + 1 < n && !(text[i] === '*' && text[i + 1] === '/')) i++;
      i += 2;
      continue;
    }
    out += ch;
    i++;
  }
  // Remove trailing commas before } or ]
  return out.replace(/,(?=\s*[}\]])/g, '');
}

function safeParse(text) {
  try {
    return JSON.parse(stripJsonc(String(text || '')));
  } catch {
    return null;
  }
}

function isFile(f) {
  return f && f.type === 'file';
}

/** The launch file: `.synapse/launch.json` preferred, then root `launch.json`. */
export function findLaunchFile(files) {
  const rels = new Map();
  for (const f of files) {
    if (!isFile(f)) continue;
    const rel = relPathOf(f, files);
    if (!rels.has(rel)) rels.set(rel, f);
  }
  if (rels.has('.synapse/launch.json')) return rels.get('.synapse/launch.json');
  if (rels.has('launch.json')) return rels.get('launch.json');
  return null;
}

/** The tasks file: `tasks.json` at the project root. */
export function findTasksFile(files) {
  for (const f of files) {
    if (!isFile(f)) continue;
    if (relPathOf(f, files) === 'tasks.json') return f;
  }
  return null;
}

/**
 * Parse a launch.json text → [{ name, type: 'node'|'python', program, args: [] }].
 * Invalid input → [].
 */
export function parseLaunchConfig(text) {
  const doc = safeParse(text);
  if (!doc || typeof doc !== 'object') return [];
  const list = Array.isArray(doc) ? doc : doc.configurations;
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const c of list) {
    if (!c || typeof c !== 'object') continue;
    const program = typeof c.program === 'string' ? c.program.trim() : '';
    if (!program) continue;
    const base = program.split('/').pop();
    const type =
      c.type === 'node' || c.type === 'python'
        ? c.type
        : program.endsWith('.py')
          ? 'python'
          : 'node';
    const args = Array.isArray(c.args)
      ? c.args.map((a) => String(a))
      : typeof c.args === 'string'
        ? [c.args]
        : [];
    out.push({
      name: typeof c.name === 'string' && c.name.trim() ? c.name.trim() : base,
      type,
      program,
      args,
    });
  }
  return out;
}

/**
 * Parse a tasks.json text → [{ label, command }]. Entries without
 * label/command are skipped; { command, args: [] } is flattened.
 */
export function parseTasks(text) {
  const doc = safeParse(text);
  if (!doc || typeof doc !== 'object') return [];
  const list = doc.tasks;
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const t of list) {
    if (!t || typeof t !== 'object') continue;
    const label = typeof t.label === 'string' ? t.label.trim() : '';
    const cmd = typeof t.command === 'string' ? t.command.trim() : '';
    if (!label || !cmd) continue;
    let command = cmd;
    if (Array.isArray(t.args) && t.args.length) {
      command += ' ' + t.args.map((a) => String(a)).join(' ');
    }
    out.push({ label, command });
  }
  return out;
}
