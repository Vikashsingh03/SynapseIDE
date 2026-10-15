






const RESERVED = new Set([
  'const', 'let', 'var', 'function', 'return', 'if', 'else', 'for', 'while',
  'class', 'import', 'export', 'default', 'new', 'delete', 'typeof', 'switch',
  'case', 'break', 'continue', 'try', 'catch', 'finally', 'throw', 'in', 'of',
  'instanceof', 'void', 'yield', 'async', 'await', 'static', 'extends', 'super',
  'this', 'null', 'true', 'false', 'undefined',
]);

 
export function isValidIdentifier(name) {
  if (typeof name !== 'string' || name.length === 0) return false;
  if (!/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(name)) return false;
  return !RESERVED.has(name);
}

function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}






function wholeWordRegExp(word) {
  return new RegExp(`(?<![A-Za-z0-9_$])${escapeRegExp(word)}(?![A-Za-z0-9_$])`, 'g');
}

 
export function countOccurrences(content, word) {
  if (!content || !word || typeof word !== 'string') return 0;
  const matches = String(content).match(wholeWordRegExp(word));
  return matches ? matches.length : 0;
}







export function buildRenamePlan(files, oldName, newName) {
  const empty = { updates: [], totalOccurrences: 0, filesAffected: 0 };
  if (!isValidIdentifier(oldName) || !isValidIdentifier(newName)) return empty;
  if (oldName === newName) return empty;

  const regex = wholeWordRegExp(oldName);
  const updates = [];
  let totalOccurrences = 0;

  for (const file of Array.isArray(files) ? files : []) {
    if (!file || file.type === 'folder') continue;
    const content = file.content;
    if (!content) continue;
    const count = countOccurrences(content, oldName);
    if (count === 0) continue;
    
    regex.lastIndex = 0;
    const replaced = String(content).replace(regex, newName);
    updates.push({
      fileId: file.id,
      fileName: file.name,
      count,
      content: replaced,
    });
    totalOccurrences += count;
  }

  return { updates, totalOccurrences, filesAffected: updates.length };
}
