const MAX_SYMBOLS = 300;

const CONTROL_WORDS = new Set([
  'if',
  'for',
  'while',
  'switch',
  'catch',
  'return',
  'else',
  'do',
  'with',
  'try',
  'finally',
  'throw',
  'typeof',
  'instanceof',
  'new',
  'delete',
  'void',
  'in',
  'of',
  'case',
  'function',
  'class',
  'extends',
  'super',
  'this',
  'await',
  'yield',
  'sizeof',
  'synchronized',
]);

const JS_EXTENSIONS = new Set(['js', 'jsx', 'ts', 'tsx', 'mjs', 'cjs', 'mts', 'cts']);
const C_EXTENSIONS = new Set(['c', 'h', 'cpp', 'cxx', 'cc', 'hpp', 'hh', 'cs']);

function extensionOf(fileName) {
  const base = String(fileName || '').split('/').pop();
  const dot = base.lastIndexOf('.');
  return dot > 0 ? base.slice(dot + 1).toLowerCase() : '';
}

function stripNoise(line) {
  let out = '';
  let quote = null;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quote) {
      if (ch === '\\') {
        out += ' ';
        if (i + 1 < line.length) {
          out += ' ';
          i += 1;
        }
        continue;
      }
      if (ch === quote) quote = null;
      out += ' ';
      continue;
    }
    if (ch === '/' && line[i + 1] === '/') break;
    if (ch === "'" || ch === '"' || ch === '`') {
      quote = ch;
      out += ' ';
      continue;
    }
    out += ch;
  }
  return out;
}

function matchMethodLike(trimmed, className) {
  if (trimmed.endsWith(';')) return null;
  if (!trimmed.includes('(')) return null;
  const m = trimmed.match(
    /^(.*?)([A-Za-z_]\w*)\s*\(([^;{}]*)\)\s*(?:const\s*)?(?:noexcept\s*)?(?:override\s*)?(?:final\s*)?(?:throws\s+[\w\s,.]+)?\s*(?::[^{]*)?\{?\s*$/
  );
  if (!m) return null;
  const prefix = m[1].trim();
  const name = m[2];
  if (CONTROL_WORDS.has(name)) return null;
  if (prefix.endsWith('.')) return null;
  if (prefix.includes('=')) return null;
  if (/^return\b/.test(prefix)) return null;
  if (/\b(?:if|for|while|switch|catch)\s*$/.test(prefix)) return null;
  if (!prefix && name !== className) return null;
  return { name, prefix };
}

function matchJsSymbol(code, ctx) {
  const trimmed = code.trim();
  if (!trimmed) return null;
  let m = trimmed.match(/\binterface\s+([A-Za-z_$][\w$]*)/);
  if (m) return { name: m[1], kind: 'interface' };
  m = trimmed.match(/\benum\s+([A-Za-z_$][\w$]*)/);
  if (m) return { name: m[1], kind: 'enum' };
  m = trimmed.match(/^(?:export\s+)?(?:declare\s+)?type\s+([A-Za-z_$][\w$]*)\s*(?:<[^>]*>)?\s*=/);
  if (m) return { name: m[1], kind: 'type' };
  m = trimmed.match(/\bclass\s+([A-Za-z_$][\w$]*)/);
  if (m) return { name: m[1], kind: 'class' };
  m = trimmed.match(/\bfunction\s*\*?\s*([A-Za-z_$][\w$]*)\s*(?:<[^>]*>)?\s*\(/);
  if (m) return { name: m[1], kind: 'function' };
  m = trimmed.match(
    /^(?:export\s+)?(?:default\s+)?(?:declare\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*(?::\s*[^=;]+?)?\s*=\s*(.+)$/
  );
  if (m) {
    const rest = m[2].trim();
    if (/^function\b/.test(rest) || /^async\s+function\b/.test(rest) || rest.includes('=>')) {
      return { name: m[1], kind: 'function' };
    }
    if (ctx.startDepth === 0) return { name: m[1], kind: 'variable' };
    return null;
  }
  if (ctx.inClassDirect) {
    m = trimmed.match(
      /^(?:(?:public|private|protected|static|async|abstract|readonly|override|declare)\s+)*(?:(?:get|set)\s+)?([A-Za-z_$][\w$]*)\s*\([^)]*\)\s*(?::\s*[^{};]+)?\{?\s*$/
    );
    if (m && !CONTROL_WORDS.has(m[1])) return { name: m[1], kind: 'method' };
    m = trimmed.match(
      /^(?:(?:public|private|protected|static|readonly|declare)\s+)*([A-Za-z_$][\w$]*)\s*(?::\s*[^=;]+)?=[^=]/
    );
    if (m && !CONTROL_WORDS.has(m[1])) return { name: m[1], kind: 'variable' };
    m = trimmed.match(
      /^(?:(?:public|private|protected|static|readonly|declare)\s+)*([A-Za-z_$][\w$]*)\s*(?::\s*[^;{]+)?;$/
    );
    if (m && !CONTROL_WORDS.has(m[1])) return { name: m[1], kind: 'variable' };
  }
  return null;
}

function matchJavaSymbol(code, ctx) {
  const trimmed = code.trim();
  if (!trimmed) return null;
  let m = trimmed.match(/\bclass\s+([A-Za-z_]\w*)/);
  if (m && !trimmed.endsWith(';')) return { name: m[1], kind: 'class' };
  m = trimmed.match(/\binterface\s+([A-Za-z_]\w*)/);
  if (m && !trimmed.endsWith(';')) return { name: m[1], kind: 'interface' };
  m = trimmed.match(/\benum\s+([A-Za-z_]\w*)/);
  if (m && !trimmed.endsWith(';')) return { name: m[1], kind: 'enum' };
  if (!ctx.inClassDirect) return null;
  const found = matchMethodLike(trimmed, ctx.className);
  return found ? { name: found.name, kind: 'method' } : null;
}

function matchCSymbol(code, ctx) {
  const trimmed = code.trim();
  if (!trimmed || trimmed.startsWith('#')) return null;
  let m = trimmed.match(/\b(?:class|struct)\s+([A-Za-z_]\w*)/);
  if (m && !trimmed.endsWith(';')) return { name: m[1], kind: 'class' };
  m = trimmed.match(/\benum\s+([A-Za-z_]\w*)/);
  if (m && !trimmed.endsWith(';')) return { name: m[1], kind: 'enum' };
  const found = matchMethodLike(trimmed, ctx.className);
  if (!found) return null;
  if (found.prefix.includes('::')) return { name: found.name, kind: 'method' };
  if (ctx.inClassDirect) return { name: found.name, kind: 'method' };
  if (ctx.startDepth === 0) return { name: found.name, kind: 'function' };
  return null;
}

function extractBraceSymbols(lines, matcher) {
  const symbols = [];
  let braceDepth = 0;
  const classStack = [];
  let pendingClass = null;
  for (let i = 0; i < lines.length; i++) {
    const code = stripNoise(lines[i]);
    const startDepth = braceDepth;
    while (classStack.length && classStack[classStack.length - 1].bodyDepth > startDepth) {
      classStack.pop();
    }
    const top = classStack.length ? classStack[classStack.length - 1] : null;
    const ctx = {
      startDepth,
      inClassDirect: Boolean(top) && top.bodyDepth === startDepth,
      className: top ? top.name : null,
    };
    const found = matcher(code, ctx);
    let scopeDeclared = false;
    if (found) {
      symbols.push({ name: found.name, kind: found.kind, line: i + 1, depth: startDepth });
      scopeDeclared = found.kind === 'class' || found.kind === 'interface' || found.kind === 'enum';
      if (symbols.length >= MAX_SYMBOLS) break;
    }
    let delta = 0;
    for (const ch of code) {
      if (ch === '{') delta += 1;
      else if (ch === '}') delta -= 1;
    }
    const nextDepth = Math.max(0, startDepth + delta);
    if (scopeDeclared) {
      if (nextDepth > startDepth) {
        classStack.push({ bodyDepth: nextDepth, name: found.name });
      } else if (!code.includes('{')) {
        pendingClass = { depth: startDepth, name: found.name };
      }
    } else if (pendingClass && nextDepth > pendingClass.depth) {
      classStack.push({ bodyDepth: nextDepth, name: pendingClass.name });
      pendingClass = null;
    }
    braceDepth = nextDepth;
  }
  return symbols;
}

function extractPythonSymbols(lines) {
  const symbols = [];
  const stack = [];
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    if (!raw.trim()) continue;
    const indent = raw.match(/^\s*/)[0].replace(/\t/g, '    ').length;
    let m = raw.match(/^\s*class\s+([A-Za-z_]\w*)\s*[:(]/);
    let kind = 'class';
    if (!m) {
      m = raw.match(/^\s*(?:async\s+)?def\s+([A-Za-z_]\w*)\s*\(/);
      kind = 'def';
    }
    if (!m) continue;
    while (stack.length && stack[stack.length - 1].indent >= indent) stack.pop();
    const depth = stack.length;
    if (kind === 'def') {
      kind = stack.length && stack[stack.length - 1].kind === 'class' ? 'method' : 'function';
    }
    symbols.push({ name: m[1], kind, line: i + 1, depth });
    stack.push({ indent, kind });
    if (symbols.length >= MAX_SYMBOLS) break;
  }
  return symbols;
}

export function extractSymbols(content, fileName) {
  if (typeof content !== 'string' || !content) return [];
  const ext = extensionOf(fileName);
  const lines = content.split(/\r?\n/);
  if (JS_EXTENSIONS.has(ext)) return extractBraceSymbols(lines, matchJsSymbol);
  if (ext === 'py') return extractPythonSymbols(lines);
  if (ext === 'java') return extractBraceSymbols(lines, matchJavaSymbol);
  if (C_EXTENSIONS.has(ext)) return extractBraceSymbols(lines, matchCSymbol);
  return [];
}
