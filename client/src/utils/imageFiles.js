const IMAGE_MIME_BY_EXTENSION = new Map([
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.gif', 'image/gif'],
  ['.webp', 'image/webp'],
  ['.svg', 'image/svg+xml'],
  ['.ico', 'image/x-icon'],
  ['.bmp', 'image/bmp'],
  ['.avif', 'image/avif'],
]);

function extensionOf(name) {
  const normalized = String(name || '').replace(/\\/g, '/');
  const baseName = normalized.slice(normalized.lastIndexOf('/') + 1).toLowerCase();
  const dot = baseName.lastIndexOf('.');
  return dot > 0 ? baseName.slice(dot) : '';
}

export function isImageFile(name) {
  return IMAGE_MIME_BY_EXTENSION.has(extensionOf(name));
}

export function imageMimeFor(name) {
  return IMAGE_MIME_BY_EXTENSION.get(extensionOf(name)) || null;
}

export function resolveImageSrc(file) {
  if (!file || typeof file.content !== 'string') return null;
  const content = file.content;
  if (content.startsWith('data:image/')) return content;
  if (/^https?:\/\//i.test(content)) return content;
  if (extensionOf(file.name) === '.svg' && content.trim()) {
    return `data:image/svg+xml;utf8,${encodeURIComponent(content)}`;
  }
  return null;
}
