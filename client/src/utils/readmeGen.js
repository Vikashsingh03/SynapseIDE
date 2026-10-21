export const MAX_TREE_FILES = 120;
export const MAX_README_EXCERPT_CHARS = 1500;

function comparePaths(a, b) {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

export function relPathOf(file, files) {
  if (!file) return '';
  const byId = new Map((Array.isArray(files) ? files : []).map((f) => [f.id, f]));
  const parts = [];
  const seen = new Set();
  let current = file;
  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    parts.unshift(current.name);
    current = current.parentId ? byId.get(current.parentId) : null;
  }
  return parts.join('/');
}

function parsePackageJson(content) {
  try {
    const data = JSON.parse(String(content || ''));
    if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
    return {
      name: typeof data.name === 'string' ? data.name : '',
      scripts:
        data.scripts && typeof data.scripts === 'object' && !Array.isArray(data.scripts)
          ? Object.keys(data.scripts)
          : [],
      dependencies:
        data.dependencies &&
        typeof data.dependencies === 'object' &&
        !Array.isArray(data.dependencies)
          ? Object.keys(data.dependencies)
          : [],
    };
  } catch {
    return null;
  }
}

function buildTree(paths) {
  if (paths.length <= MAX_TREE_FILES) return paths.join('\n');
  const topLevel = [];
  const firstLevel = [];
  for (const p of paths) {
    const segs = p.split('/');
    if (segs.length === 1) topLevel.push(p);
    else if (segs.length === 2) firstLevel.push(p);
  }
  let shown = [...topLevel, ...firstLevel].sort(comparePaths);
  if (!shown.length) shown = paths.slice(0, MAX_TREE_FILES - 1);
  if (shown.length > MAX_TREE_FILES - 1) shown = shown.slice(0, MAX_TREE_FILES - 1);
  const omitted = paths.length - shown.length;
  return [...shown, `… and ${omitted} more files`].join('\n');
}

export function collectProjectSummary(files) {
  const list = Array.isArray(files) ? files : [];
  const pairs = list
    .filter((f) => f && f.type !== 'folder')
    .map((file) => ({ file, path: relPathOf(file, list) }))
    .filter((p) => p.path)
    .sort((a, b) => comparePaths(a.path, b.path));

  const tree = buildTree(pairs.map((p) => p.path));

  let clientPkg = null;
  let serverPkg = null;
  for (const { file, path } of pairs) {
    const segs = path.split('/');
    if (segs[segs.length - 1] !== 'package.json' || segs.length > 2) continue;
    const parsed = parsePackageJson(file.content);
    if (!parsed) continue;
    const dir = segs.length === 2 ? segs[0].toLowerCase() : '';
    if (dir === 'server') {
      if (!serverPkg) serverPkg = parsed;
    } else if (dir === 'client' || dir === '') {
      if (!clientPkg) clientPkg = parsed;
    } else if (!serverPkg) {
      serverPkg = parsed;
    } else if (!clientPkg) {
      clientPkg = parsed;
    }
  }

  let existingReadme = null;
  let readmeFileId = null;
  const readme = pairs.find(
    ({ file, path }) => path === file.name && file.name.toLowerCase() === 'readme.md'
  );
  if (readme) {
    readmeFileId = readme.file.id;
    const content = String(readme.file.content || '');
    if (content.trim()) {
      existingReadme =
        content.length > MAX_README_EXCERPT_CHARS
          ? content.slice(0, MAX_README_EXCERPT_CHARS)
          : content;
    }
  }

  return { tree, clientPkg, serverPkg, existingReadme, readmeFileId };
}

export function cleanReadmeMarkdown(text, projectName) {
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
