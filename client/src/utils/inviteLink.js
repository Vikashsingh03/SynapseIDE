export function buildInviteLink(origin, roomId) {
  const base = String(origin ?? '').trim().replace(/\/+$/, '');
  const code = encodeURIComponent(String(roomId ?? '').trim());
  return `${base}/join-room?code=${code}`;
}

export function extractInviteCode(search) {
  const raw = String(search ?? '');
  const query = raw.startsWith('?') ? raw.slice(1) : raw;
  if (!query) return '';
  const params = new URLSearchParams(query);
  const value = params.get('code') || params.get('room') || '';
  return value.trim();
}

export function isPlausibleRoomCode(code) {
  const length = String(code ?? '').trim().length;
  return length >= 4 && length <= 12;
}
