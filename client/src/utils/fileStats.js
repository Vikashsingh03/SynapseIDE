const encoder = new TextEncoder();

function formatSizeLabel(sizeBytes) {
  if (sizeBytes < 1024) return `${sizeBytes} B`;
  if (sizeBytes < 1024 * 1024) return `${(sizeBytes / 1024).toFixed(1)} KB`;
  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function isDataContent(content) {
  return typeof content === 'string' && content.startsWith('data:');
}

export function computeFileStats(content) {
  if (typeof content !== 'string') {
    return { words: 0, lines: 0, chars: 0, sizeBytes: 0, sizeLabel: '0 B' };
  }
  const sizeBytes = encoder.encode(content).length;
  if (content.length === 0) {
    return { words: 0, lines: 0, chars: 0, sizeBytes: 0, sizeLabel: '0 B' };
  }
  const tokens = content.split(/\s+/).filter((token) => token.length > 0);
  const lines = content.split('\n').length;
  return {
    words: tokens.length,
    lines,
    chars: content.length,
    sizeBytes,
    sizeLabel: formatSizeLabel(sizeBytes),
  };
}
