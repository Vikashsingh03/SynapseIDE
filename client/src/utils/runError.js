import { extractContextWindow } from './neuraFix.js';

const MAX_ERROR_CHARS = 3000;
const MAX_MESSAGE_CHARS = 300;
const MAX_FULL_LINES = 400;
const MAX_FULL_CHARS = 20000;
const HEAD_LINES = 150;

const GCC_RE = /^(.+?\.[A-Za-z]{1,6}):(\d+):(\d+):\s*(?:fatal\s+)?error:\s*(.+)$/;
const JAVAC_RE = /^(.+?\.[A-Za-z]{1,6}):(\d+):\s*error:\s*(.+)$/;
const PY_FRAME_RE = /File\s+"[^"]+",\s+line\s+(\d+)/;
const NODE_MSG_RE = /^([A-Za-z_$][\w$.]*(?:Error|Exception))\s*:\s*(.+)$/;
const NODE_FRAME_RE = /^\s*at\s+.*\(([^()]+):(\d+):(\d+)\)\s*$/;

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

function scanStrong(lines) {
  for (const raw of lines) {
    const t = String(raw || '').trim();
    if (!t) continue;
    let m = GCC_RE.exec(t);
    if (m) {
      return { line: Number(m[2]), column: Number(m[3]), message: m[4].trim().slice(0, MAX_MESSAGE_CHARS), headline: t.slice(0, MAX_MESSAGE_CHARS) };
    }
    m = JAVAC_RE.exec(t);
    if (m) {
      return { line: Number(m[2]), column: null, message: m[3].trim().slice(0, MAX_MESSAGE_CHARS), headline: t.slice(0, MAX_MESSAGE_CHARS) };
    }
  }

  let lastFrameLine = null;
  let hasTraceback = false;
  for (const raw of lines) {
    if (String(raw || '').includes('Traceback (most recent call last):')) hasTraceback = true;
    const fm = PY_FRAME_RE.exec(String(raw || ''));
    if (fm) lastFrameLine = Number(fm[1]);
  }
  if (hasTraceback || lastFrameLine) {
    const nonEmpty = lines.map((l) => String(l || '').trim()).filter(Boolean);
    const last = nonEmpty[nonEmpty.length - 1] || '';
    if (last && /error|exception/i.test(last) && !PY_FRAME_RE.test(last)) {
      return { line: lastFrameLine, column: null, message: last.slice(0, MAX_MESSAGE_CHARS), headline: last.slice(0, MAX_MESSAGE_CHARS) };
    }
    if (lastFrameLine) {
      return { line: lastFrameLine, column: null, message: 'Python error — see the traceback in the output.', headline: 'Python traceback' };
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const t = String(lines[i] || '').trim();
    const nm = NODE_MSG_RE.exec(t);
    if (!nm) continue;
    let frameLine = null;
    let frameColumn = null;
    for (let j = i + 1; j < lines.length; j++) {
      const fm = NODE_FRAME_RE.exec(String(lines[j] || ''));
      if (fm) {
        frameLine = Number(fm[2]);
        frameColumn = Number(fm[3]);
        break;
      }
    }
    return {
      line: frameLine,
      column: frameColumn,
      message: `${nm[1]}: ${nm[2].trim()}`.slice(0, MAX_MESSAGE_CHARS),
      headline: t.slice(0, MAX_MESSAGE_CHARS),
    };
  }

  return null;
}

export function parseRunError(outputText, fileName) {
  const text = String(outputText || '');
  if (!text.trim()) return null;
  const lines = text.split('\n');
  const strong = scanStrong(lines);
  if (strong) return strong;
  for (const raw of lines) {
    const t = String(raw || '').trim();
    if (!t) continue;
    if (/error|exception/i.test(t)) {
      return { line: null, column: null, message: t.slice(0, MAX_MESSAGE_CHARS), headline: t.slice(0, MAX_MESSAGE_CHARS) };
    }
  }
  return null;
}

export function getRunErrorText(output) {
  if (!output || typeof output !== 'object') return null;
  const structured = [output.stderr, output.compile_output, output.error];
  for (const field of structured) {
    if (field && String(field).trim()) {
      const parsed = parseRunError(field);
      if (parsed) return { text: String(field), parsed };
    }
  }
  if (output.stdout && String(output.stdout).trim()) {
    const strong = scanStrong(String(output.stdout).split('\n'));
    if (strong) return { text: String(output.stdout), parsed: strong };
  }
  return null;
}

export function buildExplainPrompt({ fileName, language, errorText, parsed, fileContent }) {
  const content = String(fileContent || '');
  const lineCount = content.split('\n').length;
  const lang = languageOf(fileName);
  const fence = lang ? `\`\`\`${lang}` : '```';
  let codeSection;
  if (lineCount <= MAX_FULL_LINES && content.length <= MAX_FULL_CHARS) {
    codeSection = ['Meri file ka pura code:', '', fence, content, '```'].join('\n');
  } else if (parsed && parsed.line) {
    const { window, firstLine, lastLine, totalLines } = extractContextWindow(content, parsed.line, 12);
    codeSection = [
      `NOTE: file badi hai (${totalLines} lines), isliye ye sirf error ke aas-paas ki lines ${firstLine}-${lastLine} hain:`,
      '',
      '```',
      window,
      '```',
    ].join('\n');
  } else {
    const head = content.split('\n').slice(0, HEAD_LINES).join('\n');
    codeSection = [
      `NOTE: file badi hai, isliye ye uski pehli ${HEAD_LINES} lines hain:`,
      '',
      fence,
      head,
      '```',
    ].join('\n');
  }

  const whereLine = parsed && parsed.line
    ? `2. Kis line pe aur kyun hua — khaas karke line ${parsed.line} ke aas-paas kya galat hai.`
    : '2. Kahan aur kyun hua — code ke kis hisse ki wajah se ye error aaya.';

  return [
    `Mere ${language || lang || 'program'} program ko run karne par ye error aaya hai. File: ${fileName || 'unknown'}.`,
    '',
    'Error output:',
    '```',
    String(errorText || '').slice(0, MAX_ERROR_CHARS),
    '```',
    '',
    codeSection,
    '',
    'Ab is error ko SIMPLE Hindi-English mix mein, jaise ek dost ko samjhate hain, is format mein samjhao:',
    '1. Error ka matlab — ye error keh kya raha hai, seedhe aur simple shabdon mein.',
    whereLine,
    '3. Sahi code — galat hisse ka theek kiya hua chhota sa snippet dikhao.',
    '4. Yaad rakhne wali baat — ek line mein wo rule ya tip jo agli baar ye galti rok de.',
    '',
    'Sirf samjhao — koi file change propose mat karo, bas explanation do.',
  ].join('\n');
}

export function buildRunFixDetail({ outputText, file }) {
  if (!file || !file.id) return null;
  const parsed = parseRunError(outputText, file.name);
  if (!parsed) return null;
  return {
    fileId: file.id,
    relPath: file.name,
    fileName: file.name,
    line: parsed.line,
    column: parsed.column,
    message: parsed.line ? parsed.message : (parsed.headline || parsed.message),
  };
}
