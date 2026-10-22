const MAX_TEST_SOURCE_CHARS = 3500;

function cleanGeneratedTests(text) {
  let out = String(text || '').replace(/\r\n/g, '\n').trim();
  if (!out) return '';
  if (out.startsWith('```') && out.endsWith('```') && out.length > 6) {
    out = out.slice(3, -3).replace(/^[A-Za-z0-9_-]+[ \t]*\n/, '').trim();
  }
  return out;
}

function detectModuleStyle(content) {
  const src = String(content || '');
  if (src.includes('module.exports')) return 'cjs';
  if (/(^|\n)\s*(const|let|var)\s+[^=\n]*=\s*require\(/.test(src)) return 'cjs';
  return 'esm';
}

function buildTestPrompt({ fileName, content, truncated }) {
  const safeName = String(fileName || 'source.js');
  let src = String(content || '');
  let wasTruncated = truncated === true;
  if (src.length > MAX_TEST_SOURCE_CHARS) {
    src = src.slice(0, MAX_TEST_SOURCE_CHARS);
    wasTruncated = true;
  }
  const style = detectModuleStyle(src);
  const loadLine =
    style === 'cjs'
      ? `The source file uses CommonJS. Load the functions under test with require, like: const { add } = require('./${safeName}');`
      : `The source file uses ES Modules. Load the functions under test with an import, like: import { add } from './${safeName}';`;
  const parts = [
    'Write a complete test file for the JavaScript source file given below.',
    'Use ONLY the built-in node:test and node:assert modules. No external test frameworks and no extra dependencies.',
    loadLine,
    'Cover the main exported functions: happy-path cases for each one, plus edge cases such as empty or invalid inputs and boundary values.',
    'Keep every case small and deterministic. Every test must be independent of the others.',
    'Output ONLY the test file code. No markdown fences, no explanations, no commentary.',
    '',
    `Source file: ${safeName}`,
  ];
  if (wasTruncated) {
    parts.push(
      'Note: the source below was truncated for length. Write tests only for the parts you can see.'
    );
  }
  parts.push('', 'Source code:', src);
  return parts.join('\n');
}

module.exports = {
  buildTestPrompt,
  cleanGeneratedTests,
  detectModuleStyle,
  MAX_TEST_SOURCE_CHARS,
};
