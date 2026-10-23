import { imageMimeFor, isImageFile } from './imageFiles.js';

const JUNK_SEGMENTS = new Set(['__MACOSX', '.git', 'node_modules', 'dist', 'build', '.next']);
const BINARY_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.pdf', '.zip',
  '.mp3', '.mp4', '.woff', '.woff2', '.ttf', '.eot', '.exe', '.dll', '.bin',
]);
const MAX_IMPORT_FILES = 300;
const MAX_TEXT_BYTES = 512 * 1024;
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const OWNER_PATTERN = /^[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?$/;
const REPO_PATTERN = /^[A-Za-z0-9._-]+$/;

function extensionOf(name) {
  const lower = String(name || '').toLowerCase();
  const dot = lower.lastIndexOf('.');
  return dot > 0 ? lower.slice(dot) : '';
}

export function parseGithubRepo(input) {
  if (typeof input !== 'string') return null;
  let text = input.trim();
  if (!text) return null;
  text = text.split('#')[0].split('?')[0].trim();
  if (!text) return null;
  text = text.replace(/^[A-Za-z][A-Za-z0-9+.-]*:\/\//, '');
  if (text.toLowerCase().startsWith('www.')) text = text.slice(4);
  const lowerText = text.toLowerCase();
  if (lowerText.startsWith('github.com/')) {
    text = text.slice('github.com/'.length);
  } else if (lowerText === 'github.com') {
    return null;
  } else {
    const firstSegment = text.split('/')[0];
    if (firstSegment.includes('.') || firstSegment.includes(':')) return null;
  }
  const segments = text.split('/').filter(Boolean);
  if (segments.length < 2) return null;
  const owner = segments[0];
  let repo = segments[1];
  const rest = segments.slice(2);
  let branch = null;
  if (rest.length) {
    if (rest[0] !== 'tree' || rest.length < 2) return null;
    branch = rest.slice(1).join('/');
    if (!branch.trim() || /\s/.test(branch)) return null;
  }
  if (repo.toLowerCase().endsWith('.git')) repo = repo.slice(0, -4);
  if (!OWNER_PATTERN.test(owner)) return null;
  if (!repo || repo === '.' || repo === '..' || !REPO_PATTERN.test(repo)) return null;
  return { owner, repo, branch };
}

export function planGithubTree(treeItems) {
  const folderSet = new Set();
  const candidateFolders = new Set();
  const files = [];
  const skipped = [];
  const list = (Array.isArray(treeItems) ? treeItems : []).map((item) => {
    const rawPath = String(item?.path ?? '');
    const normalized = rawPath.replace(/\\/g, '/').replace(/^\.\//, '');
    const segments = normalized.split('/').filter(Boolean);
    return {
      normalized,
      segments,
      joined: segments.join('/'),
      size: Math.max(0, Number(item?.size) || 0),
      isTree: item?.type === 'tree',
      isBlob: item?.type === 'blob',
    };
  });

  const addAncestors = (segments) => {
    let acc = '';
    for (let i = 0; i < segments.length - 1; i += 1) {
      acc = acc ? `${acc}/${segments[i]}` : segments[i];
      folderSet.add(acc);
    }
  };

  for (const entry of list) {
    const { normalized, segments, joined, size, isTree, isBlob } = entry;
    if (!segments.length) continue;
    const isUnsafe = normalized.startsWith('/') || segments.includes('..');
    const isJunk = segments.some((segment) => JUNK_SEGMENTS.has(segment)) || segments[segments.length - 1] === '.DS_Store';

    if (isTree) {
      if (!isUnsafe && !isJunk) candidateFolders.add(joined);
      continue;
    }
    if (!isBlob) {
      skipped.push({ path: joined, reason: 'unsupported' });
      continue;
    }
    if (isUnsafe) {
      skipped.push({ path: joined, reason: 'unsafe' });
      continue;
    }
    if (isJunk) {
      skipped.push({ path: joined, reason: 'junk' });
      continue;
    }

    const fileName = segments[segments.length - 1];
    const extension = extensionOf(fileName);
    const importAsDataUrl = isImageFile(fileName) && extension !== '.svg';
    if (importAsDataUrl && size > MAX_IMAGE_BYTES) {
      skipped.push({ path: joined, reason: 'too-large' });
      continue;
    }
    if (!isImageFile(fileName) && BINARY_EXTENSIONS.has(extension)) {
      skipped.push({ path: joined, reason: 'binary' });
      continue;
    }
    if (!importAsDataUrl && size > MAX_TEXT_BYTES) {
      skipped.push({ path: joined, reason: 'too-large' });
      continue;
    }
    if (files.length >= MAX_IMPORT_FILES) {
      skipped.push({ path: joined, reason: 'too-many' });
      continue;
    }

    files.push({
      path: joined,
      size,
      kind: importAsDataUrl ? 'image' : 'text',
      ...(importAsDataUrl ? { importAsDataUrl, mimeType: imageMimeFor(fileName) } : {}),
    });
    addAncestors(segments);
  }

  for (const candidate of candidateFolders) {
    const prefix = `${candidate}/`;
    const hasAcceptedFile = files.some((file) => file.path.startsWith(prefix));
    const hasAnyFile = list.some((entry) => entry.isBlob && entry.joined.startsWith(prefix));
    if (hasAcceptedFile || !hasAnyFile) {
      folderSet.add(candidate);
      addAncestors([...candidate.split('/'), '']);
    }
  }

  const folders = [...folderSet].sort((a, b) => {
    const depthDiff = a.split('/').length - b.split('/').length;
    return depthDiff !== 0 ? depthDiff : a.localeCompare(b);
  });

  return { folders, files, skipped };
}

function rawFileUrl(owner, repo, branch, path) {
  const branchPath = String(branch).split('/').map(encodeURIComponent).join('/');
  const filePath = String(path).split('/').map(encodeURIComponent).join('/');
  return `https://raw.githubusercontent.com/${owner}/${repo}/${branchPath}/${filePath}`;
}

function githubApiError(response, repoLabel) {
  if (response.status === 404) {
    return new Error(`Repo nahi mila (${repoLabel}) — naam check karo. Repo private hai toh bhi import nahi hoga; sirf public repos import hote hain.`);
  }
  const remaining = response.headers && typeof response.headers.get === 'function'
    ? response.headers.get('x-ratelimit-remaining')
    : null;
  if ((response.status === 403 || response.status === 429) && remaining === '0') {
    return new Error('GitHub free limit khatam — kuch der baad try karo. (GitHub API rate limit exceeded)');
  }
  if (response.status === 403 || response.status === 429) {
    return new Error('GitHub ne request rok di hai — kuch der baad try karo.');
  }
  return new Error(`GitHub se data nahi aaya (error ${response.status}) — dobara try karo.`);
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Image read failed'));
    reader.readAsDataURL(blob);
  });
}

export async function fetchGithubProject(input, onProgress) {
  const parsed = parseGithubRepo(input);
  if (!parsed) {
    throw new Error('GitHub link sahi nahi hai — aisa daalo: https://github.com/owner/repo');
  }
  const { owner, repo } = parsed;
  const repoLabel = `${owner}/${repo}`;
  const apiHeaders = { Accept: 'application/vnd.github+json' };

  let repoResponse;
  try {
    repoResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers: apiHeaders });
  } catch {
    throw new Error('GitHub se connect nahi ho paaya — internet check karke dobara try karo.');
  }
  if (!repoResponse.ok) throw githubApiError(repoResponse, repoLabel);
  const repoData = await repoResponse.json().catch(() => ({}));
  const branch = parsed.branch || repoData.default_branch || 'main';

  let treeResponse;
  try {
    treeResponse = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/git/trees/${encodeURIComponent(branch)}?recursive=1`,
      { headers: apiHeaders },
    );
  } catch {
    throw new Error('GitHub se connect nahi ho paaya — internet check karke dobara try karo.');
  }
  if (!treeResponse.ok) throw githubApiError(treeResponse, repoLabel);
  const treeData = await treeResponse.json().catch(() => ({}));

  const plan = planGithubTree(Array.isArray(treeData.tree) ? treeData.tree : []);
  const skipped = [...plan.skipped];
  const total = plan.files.length;
  const files = new Array(total);
  const report = typeof onProgress === 'function' ? onProgress : null;
  if (report) report(0, total);

  let nextIndex = 0;
  let fetched = 0;
  const worker = async () => {
    while (nextIndex < total) {
      const index = nextIndex;
      nextIndex += 1;
      const planned = plan.files[index];
      const segments = planned.path.split('/');
      const name = segments[segments.length - 1];
      try {
        const response = await fetch(rawFileUrl(owner, repo, branch, planned.path));
        if (!response.ok) throw new Error('Raw fetch failed');
        if (planned.kind === 'image') {
          const blob = await response.blob();
          if (blob.size > MAX_IMAGE_BYTES) {
            skipped.push({ path: planned.path, reason: 'too-large' });
          } else {
            const content = await blobToDataUrl(blob);
            files[index] = { path: planned.path, name, size: planned.size, kind: planned.kind, content };
          }
        } else {
          const content = await response.text();
          files[index] = { path: planned.path, name, size: planned.size, kind: planned.kind, content };
        }
      } catch {
        skipped.push({ path: planned.path, reason: 'read-error' });
      }
      fetched += 1;
      if (report) report(fetched, total);
    }
  };
  const workerCount = Math.max(1, Math.min(5, total));
  await Promise.all(Array.from({ length: workerCount }, () => worker()));

  return {
    folders: plan.folders,
    files: files.filter(Boolean),
    skipped,
    repoName: repo,
  };
}
