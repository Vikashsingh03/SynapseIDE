export const MAX_TEST_SOURCE_CHARS = 3500;

export function testFileNameFor(sourceName) {
  const name = String(sourceName || '').trim();
  const base = name.replace(/\.(js|mjs|cjs|ts|mts|jsx|tsx)$/i, '');
  return `${base || 'source'}.test.js`;
}

export function cleanGeneratedTests(text) {
  let out = String(text || '').replace(/\r\n/g, '\n').trim();
  if (!out) return '';
  if (out.startsWith('```') && out.endsWith('```') && out.length > 6) {
    out = out.slice(3, -3).replace(/^[A-Za-z0-9_-]+[ \t]*\n/, '').trim();
  }
  return out;
}

export function looksLikeNodeTests(text) {
  const src = String(text || '');
  if (!src.includes('node:test')) return false;
  return src.includes('test(') || src.includes('describe(');
}

export function buildGenerateRequest({ file }) {
  const content = String(file?.content || '');
  const truncated = content.length > MAX_TEST_SOURCE_CHARS;
  return {
    fileName: file?.name || '',
    content: truncated ? content.slice(0, MAX_TEST_SOURCE_CHARS) : content,
    truncated,
  };
}
