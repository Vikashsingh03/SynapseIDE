export const TODO_TAGS = ['TODO', 'FIXME', 'HACK', 'BUG', 'NOTE', 'XXX'];

const MAX_RESULTS = 500;
const MAX_TEXT_LENGTH = 140;
const TAG_PATTERN = new RegExp(`\\b(${TODO_TAGS.join('|')})\\b`, 'g');

function remainderAfter(line, tagEndIndex) {
  let rest = line.slice(tagEndIndex);
  if (rest.startsWith('(')) {
    const closeIndex = rest.indexOf(')');
    if (closeIndex !== -1) {
      rest = rest.slice(closeIndex + 1);
    }
  }
  rest = rest.replace(/^\s*:\s*/, '');
  return rest.trim().slice(0, MAX_TEXT_LENGTH);
}

export function scanTodos(files) {
  if (!Array.isArray(files)) return [];
  const results = [];
  for (const file of files) {
    if (!file || file.type === 'folder') continue;
    if (typeof file.content !== 'string') continue;
    const lines = file.content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      TAG_PATTERN.lastIndex = 0;
      let match;
      while ((match = TAG_PATTERN.exec(line)) !== null) {
        const tag = match[1];
        results.push({
          fileId: file.id,
          fileName: file.name,
          line: i + 1,
          tag,
          text: remainderAfter(line, match.index + tag.length),
        });
      }
    }
  }
  results.sort((a, b) => {
    const nameA = String(a.fileName ?? '');
    const nameB = String(b.fileName ?? '');
    if (nameA < nameB) return -1;
    if (nameA > nameB) return 1;
    return a.line - b.line;
  });
  return results.slice(0, MAX_RESULTS);
}
