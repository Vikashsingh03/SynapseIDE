import { readStorage, removeStorage, writeStorage } from './storage';

const TOKEN_KEY = 'synapse_auth_token';
const AUTH_STORAGE_KEY = 'synapse_auth';




export function getToken() {
  return readStorage(TOKEN_KEY);
}




export function setToken(token) {
  writeStorage(TOKEN_KEY, token);
}




export function removeToken() {
  removeStorage(TOKEN_KEY);
  removeStorage(AUTH_STORAGE_KEY);
}

export function setAuthSession(session) {
  writeStorage(AUTH_STORAGE_KEY, JSON.stringify(session));
  setToken(session.token);
}

export function getAuthSession() {
  try {
    const stored = readStorage(AUTH_STORAGE_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}




export function isAuthenticated() {
  const token = getToken();
  if (!token) return false;

  
  try {
    const payload = decodeToken(token);
    if (!payload) return false;

    
    const now = Date.now() / 1000;
    if (payload.exp && payload.exp < now) {
      removeToken(); 
      return false;
    }

    return true;
  } catch {
    removeToken();
    return false;
  }
}




export function decodeToken(token) {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
}




export function getUserFromToken() {
  const token = getToken();
  if (!token) return null;

  const payload = decodeToken(token);
  if (!payload) return null;

  return {
    userId: payload.userId,
    name: payload.name,
    email: payload.email,
  };
}
