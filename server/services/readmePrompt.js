const MAX_README_NAME_CHARS = 120;
const MAX_README_TAGLINE_CHARS = 200;
const MAX_README_TREE_CHARS = 1600;
const MAX_README_PKG_CHARS = 500;
const MAX_README_EXISTING_CHARS = 800;

function capText(value, max) {
  const text = String(value || '');
  return text.length > max ? text.slice(0, max) : text;
}

function cleanReadmeMarkdown(text, projectName) {
  let out = String(text || '').replace(/\r\n/g, '\n').trim();
  if (!out) return '';
  if (out.startsWith('```') && out.endsWith('```') && out.length > 6) {
    out = out.slice(3, -3).replace(/^[A-Za-z0-9_-]+[ \t]*\n/, '').trim();
  }
  if (!out) return '';
  out = out.replace(/\n{3,}/g, '\n\n').trim();
  if (!out) return '';
  if (!out.startsWith('# ')) {
    const name = String(projectName || '').trim() || 'My Project';
    out = `# ${name}\n\n${out}`;
  }
  return out;
}

function pkgBlock(label, pkg) {
  if (!pkg || typeof pkg !== 'object' || Array.isArray(pkg)) return '';
  const name = capText(typeof pkg.name === 'string' ? pkg.name : '', 80);
  const scripts = (Array.isArray(pkg.scripts) ? pkg.scripts : [])
    .filter((s) => typeof s === 'string')
    .slice(0, 20);
  const deps = (Array.isArray(pkg.dependencies) ? pkg.dependencies : [])
    .filter((s) => typeof s === 'string')
    .slice(0, 40);
  const lines = [`${label}: ${name || '(unnamed)'}`];
  if (scripts.length) lines.push(`  scripts: ${scripts.join(', ')}`);
  if (deps.length) lines.push(`  dependencies: ${deps.join(', ')}`);
  return lines.join('\n');
}

function buildReadmePrompt({ projectName, tagline, summary }) {
  const name =
    capText(String(projectName || '').trim(), MAX_README_NAME_CHARS) || 'My Project';
  const tag = capText(String(tagline || '').trim(), MAX_README_TAGLINE_CHARS);
  const s = summary && typeof summary === 'object' ? summary : {};
  const tree = capText(typeof s.tree === 'string' ? s.tree : '', MAX_README_TREE_CHARS);
  const pkgText = [pkgBlock('Client package', s.clientPkg), pkgBlock('Server package', s.serverPkg)]
    .filter(Boolean)
    .join('\n')
    .slice(0, MAX_README_PKG_CHARS);
  const existing = capText(
    typeof s.existingReadme === 'string' ? s.existingReadme : '',
    MAX_README_EXISTING_CHARS
  );

  const parts = [
    'Write a professional GitHub README.md in Markdown for the project described below.',
    'Use ONLY the data provided. Do not invent features, routes, scripts, or commands that the data does not support. If a section does not apply, omit it instead of guessing.',
    'Structure:',
    '- Start with an H1 title using the project name, followed by a one-line description.',
    '- Features: grouped bullet points inferred only from file names and project structure.',
    '- Tech Stack: only from the package data, when present.',
    '- Project Structure: a short code block with a trimmed version of the file tree.',
    '- Getting Started: match the detected stack. For a Node project, use its package scripts for the install and run commands. For plain HTML, say to open index.html or serve the folder with any static file server.',
    '- Usage: one brief paragraph or a few short bullets based on the project shape.',
    '- License: add a License line only if a LICENSE file appears in the file tree.',
    'Output ONLY the README markdown. No code fence around the whole document, no explanations before or after.',
    '',
    `Project name: ${name}`,
  ];
  if (tag) parts.push(`Tagline: ${tag}`);
  if (pkgText) parts.push('', 'Package data:', pkgText);
  parts.push('', 'File tree:', tree || '(no files)');
  if (existing) parts.push('', 'Existing README (may be outdated):', existing);
  return parts.join('\n');
}

module.exports = {
  buildReadmePrompt,
  cleanReadmeMarkdown,
  MAX_README_NAME_CHARS,
  MAX_README_TAGLINE_CHARS,
  MAX_README_TREE_CHARS,
  MAX_README_PKG_CHARS,
  MAX_README_EXISTING_CHARS,
};
