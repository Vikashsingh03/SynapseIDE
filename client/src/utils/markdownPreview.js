export function isMarkdownFile(name) {
  if (typeof name !== 'string') return false;
  const lower = name.trim().toLowerCase();
  return lower.endsWith('.md') || lower.endsWith('.markdown');
}

export function markdownFileTitle(name) {
  if (typeof name !== 'string' || !name.trim()) return 'Markdown Preview';
  const parts = name.split(/[\\/]/);
  const base = parts[parts.length - 1].trim();
  return base || 'Markdown Preview';
}
