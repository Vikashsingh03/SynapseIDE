// Global search & replace helpers — used by the Sidebar Search panel.
// Pure functions so the matching/replacement rules stay testable.

/**
 * Builds a global RegExp from a user query.
 * Plain mode escapes regex characters (literal text search);
 * regex mode uses the pattern as-is.
 * Returns { regex, error } — regex is null for an empty query or bad pattern.
 */
export function parseSearchRegex(query, { caseSensitive = false, useRegex = false } = {}) {
  if (!query) return { regex: null, error: '' };
  const pattern = useRegex ? query : query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  try {
    return { regex: new RegExp(pattern, caseSensitive ? 'g' : 'gi'), error: '' };
  } catch {
    return { regex: null, error: 'Invalid pattern' };
  }
}

/** Counts all matches of the query in one file's content. */
export function countMatches(content, query, options) {
  const { regex } = parseSearchRegex(query, options);
  if (!regex || !content) return 0;
  const matches = content.match(regex);
  return matches ? matches.length : 0;
}

/**
 * Computes the result of replacing every match across all files.
 * Returns { updates: [{ fileId, content, count }], total, error }.
 * In regex mode the replacement may use $1, $2… capture groups;
 * in plain mode the replacement is treated as literal text.
 */
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
