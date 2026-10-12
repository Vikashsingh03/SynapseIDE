import { API_BASE } from '../config/apiConfig';
import { getToken } from './authService';

function authHeaders() {
  const token = getToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export async function getSnippets({ language, q, category } = {}) {
  const params = new URLSearchParams();
  if (language) params.set('language', language);
  if (q) params.set('q', q);
  if (category) params.set('category', category);
  const res = await fetch(`${API_BASE}/snippets?${params}`, { headers: authHeaders() });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Could not load snippets.');
  return data.snippets || [];
}

export async function createSnippet(payload) {
  const res = await fetch(`${API_BASE}/snippets`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Could not create snippet.');
  return data.snippet;
}

export async function updateSnippet(id, payload) {
  const res = await fetch(`${API_BASE}/snippets/${id}`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Could not update snippet.');
  return data.snippet;
}

export async function deleteSnippet(id) {
  const res = await fetch(`${API_BASE}/snippets/${id}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error('Could not delete snippet.');
  return true;
}

export async function trackSnippetUse(id) {
  try {
    await fetch(`${API_BASE}/snippets/${id}/use`, {
      method: 'POST',
      headers: authHeaders(),
    });
  } catch {}
}
