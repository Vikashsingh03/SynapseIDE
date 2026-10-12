const express = require('express');
const authMiddleware = require('../middleware/auth');
const Notification = require('../models/Notification');

const router = express.Router();
router.use(authMiddleware);

function getUserId(req) {
  return String(req.user.userId || req.user.id || '');
}

// GET /api/notifications?limit=20 — newest first
router.get('/', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 50);
    const items = await Notification.find({ userId: getUserId(req) })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
    const unreadCount = await Notification.countDocuments({
      userId: getUserId(req),
      read: false,
    });
    res.json({ notifications: items, unreadCount });
  } catch (err) {
    res.status(500).json({ error: 'Could not load notifications.' });
  }
});

// PATCH /api/notifications/read-all (before :id route!)
router.patch('/read-all', async (req, res) => {
  try {
    await Notification.updateMany(
      { userId: getUserId(req), read: false },
      { $set: { read: true } }
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Could not mark all as read.' });
  }
});

// PATCH /api/notifications/:id/read
router.patch('/:id/read', async (req, res) => {
  try {
    await Notification.updateOne(
      { _id: req.params.id, userId: getUserId(req) },
      { $set: { read: true } }
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Could not mark as read.' });
  }
});

module.exports = router;
