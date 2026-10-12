import { API_BASE } from '../config/apiConfig';
import { getToken } from './authService';

export async function getAnalyticsSummary() {
  const token = getToken();
  const res = await fetch(`${API_BASE}/analytics/summary`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Could not load analytics.');
  return data;
}
