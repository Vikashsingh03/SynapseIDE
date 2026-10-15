'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const MAX_FILES = 60;
const MAX_TOTAL_BYTES = 1.5 * 1024 * 1024; 
const MAX_DIAGNOSTICS = 200;
const ALLOWED_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mts', '.cts']);

function severityOf(category, ts) {
  if (category === ts.DiagnosticCategory.Error) return 'error';
  if (category === ts.DiagnosticCategory.Warning) return 'warning';
  return 'info'; 
}



function safeAbsPath(root, clientPath) {
  let p = String(clientPath).replace(/\\/g, '/');
  
  p = p.replace(/^[a-zA-Z]:/, '').replace(/^\/+/, '');
  const segments = p.split('/').filter((s) => s && s !== '.');
  const cleaned = [];
  for (const seg of segments) {
    if (seg === '..') continue; 
    cleaned.push(seg);
  }
  if (!cleaned.length) return null;
  const abs = path.resolve(root, ...cleaned);
  const rel = path.relative(root, abs);
  if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) return null;
  return abs;
}






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
      if (!d.file) continue; 
      const clientPath = absToClient.get(path.resolve(d.file.fileName));
      if (!clientPath) continue; 
      const message = ts.flattenDiagnosticMessageText(d.messageText, ' ');
      
      
      
      if (d.code === 2307) {
        const m = message.match(/Cannot find module '([^']+)'/);
        if (m && !m[1].startsWith('.') && !m[1].startsWith('/')) continue;
      }
      
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
