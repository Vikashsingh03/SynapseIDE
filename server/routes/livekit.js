/**
 * LiveKit voice/video token route.
 * Issues short-lived LiveKit access tokens for authenticated users
 * so they can join the room's voice/video call.
 *
 * Requires in server/.env:
 *   LIVEKIT_API_KEY, LIVEKIT_API_SECRET, LIVEKIT_URL (wss://xxx.livekit.cloud)
 */
const express = require('express');
const authMiddleware = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

// Lazy-load so the server boots even if livekit-server-sdk isn't installed yet.
function getAccessToken() {
  try {
    // eslint-disable-next-line global-require, import/no-dynamic-require
    return require('livekit-server-sdk').AccessToken;
  } catch {
    return null;
  }
}

function getRoomService() {
  try {
    // eslint-disable-next-line global-require, import/no-dynamic-require
    const { RoomServiceClient } = require('livekit-server-sdk');
    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;
    const wsUrl = process.env.LIVEKIT_URL;
    if (!apiKey || !apiSecret || !wsUrl) return null;
    return new RoomServiceClient(wsUrl, apiKey, apiSecret);
  } catch {
    return null;
  }
}

// GET /api/livekit/token?room=ROOM_ID
router.get('/token', async (req, res) => {
  const room = String(req.query.room || '').trim().toUpperCase();
  if (!room) {
    return res.status(400).json({ error: 'Room is required.' });
  }

  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  const wsUrl = process.env.LIVEKIT_URL;

  if (!apiKey || !apiSecret || !wsUrl) {
    return res.status(503).json({
      error: 'Voice chat is not configured. Add LIVEKIT_API_KEY, LIVEKIT_API_SECRET and LIVEKIT_URL to server/.env.',
    });
  }

  const AccessToken = getAccessToken();
  if (!AccessToken) {
    return res.status(503).json({
      error: 'livekit-server-sdk is not installed. Run: npm install livekit-server-sdk (in server/)',
    });
  }

  const identity = String(req.user.userId || req.user.email || 'guest');
  const name = String(req.user.name || req.user.email || 'Guest');

  try {
    const at = new AccessToken(apiKey, apiSecret, {
      identity,
      name,
      ttl: '2h',
    });
    at.addGrant({
      roomJoin: true,
      room,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    });

    const token = await at.toJwt();
    return res.json({ token, url: wsUrl });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[livekit] token error:', err.message);
    return res.status(500).json({ error: 'Could not create voice token.' });
  }
});

// DELETE /api/livekit/room?room=ROOM_ID
// Ends the meeting for EVERYONE by deleting the LiveKit room.
// All participants get disconnected automatically.
router.delete('/room', async (req, res) => {
  const room = String(req.query.room || '').trim().toUpperCase();
  if (!room) {
    return res.status(400).json({ error: 'Room is required.' });
  }

  const roomService = getRoomService();
  if (!roomService) {
    return res.status(503).json({ error: 'Voice chat is not configured.' });
  }

  try {
    await roomService.deleteRoom(room);
    return res.json({ ended: true, room });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[livekit] delete room error:', err.message);
    return res.status(500).json({ error: 'Could not end the meeting.' });
  }
});

module.exports = router;
