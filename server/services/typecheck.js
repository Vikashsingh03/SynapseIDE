'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const MAX_FILES = 60;
const MAX_TOTAL_BYTES = 1.5 * 1024 * 1024; // ~1.5MB
const MAX_DIAGNOSTICS = 200;
const ALLOWED_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mts', '.cts']);

function severityOf(category, ts) {
  if (category === ts.DiagnosticCategory.Error) return 'error';
  if (category === ts.DiagnosticCategory.Warning) return 'warning';
  return 'info'; // Suggestion / Message
}

// Normalize a client-supplied relative path and force it inside `root`.
// Returns an absolute path, or null if it cannot be made safe.
function safeAbsPath(root, clientPath) {
  let p = String(clientPath).replace(/\\/g, '/');
  // Strip Windows drive letters (C:/...) and leading slashes
  p = p.replace(/^[a-zA-Z]:/, '').replace(/^\/+/, '');
  const segments = p.split('/').filter((s) => s && s !== '.');
  const cleaned = [];
  for (const seg of segments) {
    if (seg === '..') continue; // drop attempts to climb out
    cleaned.push(seg);
  }
  if (!cleaned.length) return null;
  const abs = path.resolve(root, ...cleaned);
  const rel = path.relative(root, abs);
  if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) return null;
  return abs;
}

/**
 * Type-checks a set of project files with the TypeScript compiler API.
 * @param {Array<{path: string, content: string}>} files
 * @returns {Promise<Array<{path: string, line: number, column: number, severity: 'error'|'warning'|'info', code: string, message: string}>>}
 */
async function typecheckFiles(files) {
  let ts;
  try {
    ts = require('typescript');
  } catch {
    throw new Error('typescript package is not installed on the server');
  }

  const input = Array.isArray(files) ? files : [];
  const kept = [];
  let totalBytes = 0;
  for (const f of input) {
    if (kept.length >= MAX_FILES) break;
    if (!f || typeof f.path !== 'string' || typeof f.content !== 'string') continue;
    const ext = path.posix.extname(f.path).toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(ext)) continue;
    totalBytes += Buffer.byteLength(f.content, 'utf8');
    if (totalBytes > MAX_TOTAL_BYTES) break;
    kept.push({ path: f.path, content: f.content });
  }
  if (!kept.length) return [];

  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'synapse-tc-'));
  try {
    // Write files, preserving relative paths; absPath -> original client path
    const absToClient = new Map();
    const rootNames = [];
    for (const f of kept) {
      const abs = safeAbsPath(tmpRoot, f.path);
      if (!abs) continue;
      fs.mkdirSync(path.dirname(abs), { recursive: true });
      fs.writeFileSync(abs, f.content, 'utf8');
      absToClient.set(path.resolve(abs), f.path);
      rootNames.push(abs);
    }
    if (!rootNames.length) return [];

    const moduleResolution =
      ts.ModuleResolutionKind.Bundler !== undefined
        ? ts.ModuleResolutionKind.Bundler
        : ts.ModuleResolutionKind.NodeJs;

    const options = {
      target: ts.ScriptTarget.ES2020,
      module: ts.ModuleKind.ESNext,
      moduleResolution,
      jsx: ts.JsxEmit.ReactJSX,
      allowJs: true,
      checkJs: true,
      noEmit: true,
      strict: false,
      esModuleInterop: true,
      skipLibCheck: true,
      forceConsistentCasingInFileNames: true,
    };

    const host = ts.createCompilerHost(options);
    const program = ts.createProgram(rootNames, options, host);
    const allDiagnostics = ts.getPreEmitDiagnostics(program);

    const out = [];
    for (const d of allDiagnostics) {
      if (out.length >= MAX_DIAGNOSTICS) break;
      if (!d.file) continue; // skip global / option diagnostics
      const clientPath = absToClient.get(path.resolve(d.file.fileName));
      if (!clientPath) continue; // not one of the project files
      const message = ts.flattenDiagnosticMessageText(d.messageText, ' ');
      // The temp workspace has no node_modules, so imports of real npm
      // packages (react, express…) can never resolve here — those TS2307s
      // are noise, not user errors. Relative imports ('./x') still report.
      if (d.code === 2307) {
        const m = message.match(/Cannot find module '([^']+)'/);
        if (m && !m[1].startsWith('.') && !m[1].startsWith('/')) continue;
      }
      // JSX runtime types come from the same missing packages.
      if (d.code === 2875 || d.code === 7016) continue;
      const start = d.start !== undefined ? d.file.getLineAndCharacterOfPosition(d.start) : null;
      out.push({
        path: clientPath,
        line: start ? start.line + 1 : 1,
        column: start ? start.character + 1 : 1,
        severity: severityOf(d.category, ts),
        code: 'TS' + d.code,
        message,
      });
    }
    return out;
  } finally {
    try {
      fs.rmSync(tmpRoot, { recursive: true, force: true });
    } catch {}
  }
}

module.exports = { typecheckFiles };
