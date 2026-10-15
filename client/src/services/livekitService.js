import { API_BASE } from '../config/apiConfig';
import { getToken } from './authService';






export async function getLivekitToken(roomId) {
  const token = getToken();
  const response = await fetch(
    `${API_BASE}/livekit/token?room=${encodeURIComponent(roomId)}`,
    {
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    }
  );

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || 'Could not get voice chat token.');
  }

  return data; 
}






export async function endLivekitMeeting(roomId) {
  const token = getToken();
  const response = await fetch(
    `${API_BASE}/livekit/room?room=${encodeURIComponent(roomId)}`,
    {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    }
  );

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || 'Could not end the meeting.');
  }

  return data; 
}
