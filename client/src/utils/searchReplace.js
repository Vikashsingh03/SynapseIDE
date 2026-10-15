








export function parseSearchRegex(query, { caseSensitive = false, useRegex = false } = {}) {
  if (!query) return { regex: null, error: '' };
  const pattern = useRegex ? query : query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  try {
    return { regex: new RegExp(pattern, caseSensitive ? 'g' : 'gi'), error: '' };
  } catch {
    return { regex: null, error: 'Invalid pattern' };
  }
}

 
export function countMatches(content, query, options) {
  const { regex } = parseSearchRegex(query, options);
  if (!regex || !content) return 0;
  const matches = content.match(regex);
  return matches ? matches.length : 0;
}







export function computeReplacements(files, query, replacement, options = {}) {
  const { regex, error } = parseSearchRegex(query, options);
  if (!regex) return { updates: [], total: 0, error };
  const literalReplacement = options.useRegex
    ? replacement
    : replacement.replace(/\$/g, '$$$$');
  const updates = [];
  let total = 0;
  for (const file of files || []) {
    if (file.type === 'folder' || typeof file.content !== 'string' || !file.content) continue;
    const matches = file.content.match(regex);
    if (!matches) continue;
    total += matches.length;
    updates.push({
      fileId: file.id,
      content: file.content.replace(regex, literalReplacement),
      count: matches.length,
    });
  }
  return { updates, total, error: '' };
}
