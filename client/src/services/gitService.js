import { API_BASE } from '../config/apiConfig';
import { getToken } from './authService';

function headers() {
  const token = getToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function qs(roomId) {
  return roomId ? `?roomId=${encodeURIComponent(roomId)}` : '';
}

export async function gitStatus(roomId) {
  const res = await fetch(`${API_BASE}/git/status${qs(roomId)}`, { headers: headers() });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Could not read git status.');
  return data;
}

export async function gitInit(roomId) {
  const res = await fetch(`${API_BASE}/git/init`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ roomId }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'git init failed.');
  return data;
}

export async function gitAdd(roomId, files) {
  const res = await fetch(`${API_BASE}/git/add`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ roomId, files }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'git add failed.');
  return data;
}

export async function gitCommit(roomId, message) {
  const res = await fetch(`${API_BASE}/git/commit`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ roomId, message }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'git commit failed.');
  return data;
}

export async function gitLog(roomId, limit = 20) {
  const res = await fetch(`${API_BASE}/git/log${qs(roomId)}&limit=${limit}`, { headers: headers() });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Could not read git log.');
  return data.commits || [];
}

export async function gitPush(roomId) {
  const res = await fetch(`${API_BASE}/git/push`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ roomId }),
  });
  return res.json().catch(() => ({}));
}

export async function gitPull(roomId) {
  const res = await fetch(`${API_BASE}/git/pull`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ roomId }),
  });
  return res.json().catch(() => ({}));
}

export async function gitDiff(roomId, file) {
  const res = await fetch(
    `${API_BASE}/git/diff${qs(roomId)}&file=${encodeURIComponent(file)}`,
    { headers: headers() }
  );
  const data = await res.json().catch(() => ({}));
  return data.diff || '';
}
