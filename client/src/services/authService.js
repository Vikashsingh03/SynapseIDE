import {
  setAuthSession,
  removeToken,
  getToken,
  getUserFromToken,
} from '../utils/auth';
import { API_BASE } from '../config/apiConfig';
const AUTH_API_BASE = `${API_BASE}/auth`;
const AUTH_REQUEST_TIMEOUT_MS = Number(import.meta.env.VITE_AUTH_REQUEST_TIMEOUT_MS || 25000);

async function requestJson(url, options = {}, timeoutMs = AUTH_REQUEST_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
    });

    let data = {};
    try {
      data = await res.json();
    } catch {
      data = {};
    }

    if (!res.ok) {
      throw new Error(data.error || 'Request failed. Please try again.');
    }

    return data;
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new Error('Request timed out while contacting the server. Please try again.');
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}




export async function requestSignupOtp(name, email, password) {
  return requestJson(`${AUTH_API_BASE}/signup/request-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, password }),
  });
}




export async function verifySignupOtp(email, otp) {
  const data = await requestJson(`${AUTH_API_BASE}/signup/verify-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, otp }),
  });

  setAuthSession({ token: data.token, user: data.user });
  return data;
}




export async function requestLoginOtp(email, password) {
  return requestJson(`${AUTH_API_BASE}/login/request-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
}




export async function verifyLoginOtp(email, otp) {
  const data = await requestJson(`${AUTH_API_BASE}/login/verify-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, otp }),
  });

  setAuthSession({ token: data.token, user: data.user });
  return data;
}




export function logout() {
  removeToken();
}




export { getToken };




export function getCurrentUser() {
  return getUserFromToken();
}





export async function fetchProfile() {
  const token = getToken();
  if (!token) throw new Error('Not authenticated');

  return requestJson(`${AUTH_API_BASE}/me`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
}
