import JSZip from 'jszip';

const JUNK_SEGMENTS = new Set(['__MACOSX', '.git', 'node_modules']);
const BINARY_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.pdf', '.zip',
  '.mp3', '.mp4', '.woff', '.woff2', '.ttf', '.eot', '.exe', '.dll', '.bin',
]);
const MAX_IMPORT_FILES = 300;
const MAX_IMPORT_BYTES = 10 * 1024 * 1024;

export function relPathOf(file, files) {
  if (!file) return '';
  const byId = new Map((Array.isArray(files) ? files : []).map((entry) => [entry.id, entry]));
  const parts = [];
  const seen = new Set();
  let current = file;
  while (current) {
    if (seen.has(current.id)) break;
    seen.add(current.id);
    parts.unshift(String(current.name || ''));
    current = current.parentId ? byId.get(current.parentId) : null;
  }
  return parts.filter(Boolean).join('/');
}

export function buildZipObject(files) {
  const zip = new JSZip();
  const entries = [];
  const list = Array.isArray(files) ? files : [];
  for (const file of list) {
    if (!file || file.type === 'folder') continue;
    const path = relPathOf(file, list);
    if (!path) continue;
    zip.file(path, String(file.content ?? ''));
    entries.push(path);
  }
  return { zip, entries };
}

export async function buildProjectZip(files) {
  const { zip } = buildZipObject(files);
  return zip.generateAsync({ type: 'blob' });
}

function extensionOf(name) {
  const lower = String(name || '').toLowerCase();
  const dot = lower.lastIndexOf('.');
  return dot > 0 ? lower.slice(dot) : '';
}

export function planZipImport(zipEntries) {
  const folderSet = new Set();
  const candidateFolders = new Set();
  const files = [];
  const skipped = [];
  const list = (Array.isArray(zipEntries) ? zipEntries : []).map((entry) => {
    const rawPath = String(entry?.path ?? '');
    const normalized = rawPath.replace(/\\/g, '/').replace(/^\.\//, '');
    const segments = normalized.split('/').filter(Boolean);
    return {
      rawPath,
      normalized,
      segments,
      joined: segments.join('/'),
      size: Math.max(0, Number(entry?.size) || 0),
      isDirectory: Boolean(entry?.dir) || rawPath.endsWith('/'),
    };
  });
  let acceptedBytes = 0;
  let sizeExceeded = false;

  const addAncestors = (segments) => {
    let acc = '';
    for (let i = 0; i < segments.length - 1; i += 1) {
      acc = acc ? `${acc}/${segments[i]}` : segments[i];
      folderSet.add(acc);
    }
  };

  for (const entry of list) {
    const { normalized, segments, joined, size, isDirectory } = entry;
    if (!segments.length) continue;

    const isUnsafe = normalized.startsWith('/') || /^[a-zA-Z]:\//.test(normalized) || segments.includes('..');
    const isJunk = segments.some((segment) => JUNK_SEGMENTS.has(segment)) || segments[segments.length - 1] === '.DS_Store';

    if (isDirectory) {
      if (!isUnsafe && !isJunk) candidateFolders.add(joined);
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

    if (BINARY_EXTENSIONS.has(extensionOf(segments[segments.length - 1]))) {
      skipped.push({ path: joined, reason: 'binary' });
      continue;
    }
    if (files.length >= MAX_IMPORT_FILES) {
      skipped.push({ path: joined, reason: 'too-many' });
      continue;
    }
    if (sizeExceeded || acceptedBytes + size > MAX_IMPORT_BYTES) {
      sizeExceeded = true;
      skipped.push({ path: joined, reason: 'too-large' });
      continue;
    }

    acceptedBytes += size;
    files.push({ path: joined, size });
    addAncestors(segments);
  }

  for (const candidate of candidateFolders) {
    const prefix = `${candidate}/`;
    const hasAcceptedFile = files.some((file) => file.path.startsWith(prefix));
    const hasAnyFile = list.some((entry) => !entry.isDirectory && entry.joined.startsWith(prefix));
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

export async function importProjectZip(file, filesApi) {
  const zip = await JSZip.loadAsync(file);
  const entries = [];
  const entryByPath = new Map();
  zip.forEach((relativePath, zipEntry) => {
    const normalized = relativePath.replace(/\\/g, '/').replace(/^\.\//, '');
    const key = normalized.split('/').filter(Boolean).join('/');
    entries.push({
      path: relativePath,
      size: zipEntry?._data?.uncompressedSize ?? 0,
      dir: Boolean(zipEntry?.dir),
    });
    if (key) entryByPath.set(key, zipEntry);
  });

  const plan = planZipImport(entries);
  const skipped = [...plan.skipped];
  const folderIds = new Map([['', null]]);
  let importedFolders = 0;

  for (const folderPath of plan.folders) {
    const segments = folderPath.split('/');
    const name = segments[segments.length - 1];
    const parentPath = segments.slice(0, -1).join('/');
    const parentId = folderIds.has(parentPath) ? folderIds.get(parentPath) : null;
    try {
      const id = filesApi.createFolder(name, parentId);
      if (!id) throw new Error('Folder creation failed');
      folderIds.set(folderPath, id);
      importedFolders += 1;
    } catch {
      folderIds.set(folderPath, parentId);
      skipped.push({ path: folderPath, reason: 'read-error' });
    }
  }

  let importedFiles = 0;
  for (const planned of plan.files) {
    const zipEntry = entryByPath.get(planned.path);
    try {
      if (!zipEntry) throw new Error('Entry missing');
      const content = await zipEntry.async('string');
      const segments = planned.path.split('/');
      const name = segments[segments.length - 1];
      const parentPath = segments.slice(0, -1).join('/');
      const parentId = folderIds.has(parentPath) ? folderIds.get(parentPath) : null;
      const id = filesApi.createFile(name, parentId);
      if (!id) throw new Error('File creation failed');
      filesApi.updateContent(id, content);
      importedFiles += 1;
    } catch {
      skipped.push({ path: planned.path, reason: 'read-error' });
    }
  }

  return { importedFiles, importedFolders, skipped };
}
