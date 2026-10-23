import { isImageFile } from './imageFiles.js';

const TEXT_MAX_BYTES = 1024 * 1024;
const IMAGE_MAX_BYTES = 2 * 1024 * 1024;

const SKIP_EXTENSIONS = new Set([
  '.zip', '.rar', '.7z', '.tar', '.gz', '.tgz', '.bz2', '.xz', '.zst',
  '.exe', '.msi', '.dmg', '.pkg', '.deb', '.rpm', '.dll', '.so', '.dylib',
  '.bin', '.iso', '.img', '.class', '.jar', '.war', '.ear', '.o', '.a',
  '.obj', '.lib', '.pyc', '.wasm', '.dat', '.db', '.sqlite',
  '.mp3', '.wav', '.flac', '.aac', '.ogg', '.m4a',
  '.mp4', '.m4v', '.mkv', '.avi', '.mov', '.wmv', '.flv', '.webm',
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
  '.odt', '.ods', '.odp',
  '.ttf', '.otf', '.woff', '.woff2', '.eot',
]);

function extensionOf(name) {
  const normalized = String(name || '').replace(/\\/g, '/');
  const baseName = normalized.slice(normalized.lastIndexOf('/') + 1).toLowerCase();
  const dot = baseName.lastIndexOf('.');
  return dot > 0 ? baseName.slice(dot) : '';
}

export function classifyDroppedFile(name, size) {
  const fileName = String(name || '');
  if (!fileName) return 'skip';
  const bytes = typeof size === 'number' && Number.isFinite(size) && size > 0 ? size : 0;
  if (isImageFile(fileName)) {
    return bytes > IMAGE_MAX_BYTES ? 'skip' : 'image';
  }
  if (SKIP_EXTENSIONS.has(extensionOf(fileName))) return 'skip';
  if (bytes > TEXT_MAX_BYTES) return 'skip';
  return 'text';
}

export function dedupeName(existingNames, name) {
  const taken = new Set(Array.from(existingNames || [], (entry) => String(entry)));
  const original = String(name || '');
  if (!taken.has(original)) return original;
  const dot = original.lastIndexOf('.');
  const hasExtension = dot > 0;
  const base = hasExtension ? original.slice(0, dot) : original;
  const extension = hasExtension ? original.slice(dot) : '';
  let counter = 1;
  let candidate = `${base} (${counter})${extension}`;
  while (taken.has(candidate)) {
    counter += 1;
    candidate = `${base} (${counter})${extension}`;
  }
  return candidate;
}

export function readDroppedFile(file) {
  return new Promise((resolve, reject) => {
    if (!file) {
      resolve({ name: '', content: null, kind: 'skip' });
      return;
    }
    const kind = classifyDroppedFile(file.name, file.size);
    if (kind === 'skip') {
      resolve({ name: file.name, content: null, kind: 'skip' });
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error || new Error('Could not read the dropped file'));
    reader.onload = () => resolve({ name: file.name, content: String(reader.result || ''), kind });
    if (kind === 'image') {
      reader.readAsDataURL(file);
    } else {
      reader.readAsText(file);
    }
  });
}
