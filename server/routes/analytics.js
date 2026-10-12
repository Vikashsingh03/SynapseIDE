const express = require('express');
const authMiddleware = require('../middleware/auth');
const Activity = require('../models/Activity');

const router = express.Router();
router.use(authMiddleware);

function getUserId(req) {
  return String(req.user.userId || req.user.id || '');
}

function dayStr(date) {
  return date.toISOString().slice(0, 10);
}

function daysAgo(n) {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - n);
  return d;
}

// GET /api/analytics/summary — everything the dashboard needs in one call
router.get('/summary', async (req, res) => {
  try {
    const userId = getUserId(req);
    const today = daysAgo(0);
    const yearAgo = daysAgo(364);

    // ─── Daily activity counts (heatmap, last 365 days) ───
    const daily = await Activity.aggregate([
      {
        $match: {
          userId,
          createdAt: { $gte: yearAgo },
        },
      },
      {
        $group: {
          _id: '$day',
          runs: { $sum: { $cond: [{ $eq: ['$type', 'run'] }, 1, 0] } },
          rooms: {
            $sum: {
              $cond: [{ $in: ['$type', ['room_join', 'room_create']] }, 1, 0],
            },
          },
          lines: { $sum: '$linesOfCode' },
          total: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const heatmap = {};
    for (const d of daily) heatmap[d._id] = d;

    // ─── Streaks ───
    const activeDays = new Set(daily.map((d) => d._id));
    let currentStreak = 0;
    let check = new Date(today);
    // If today has no activity yet, start counting from yesterday
    if (!activeDays.has(dayStr(check))) {
      check.setUTCDate(check.getUTCDate() - 1);
    }
    while (activeDays.has(dayStr(check))) {
      currentStreak++;
      check.setUTCDate(check.getUTCDate() - 1);
    }

    // Longest streak (single pass over sorted days)
    const sortedDays = [...activeDays].sort();
    let longestStreak = 0;
    let run = 0;
    let prev = null;
    for (const ds of sortedDays) {
      const d = new Date(ds + 'T00:00:00Z');
      if (prev && d - prev === 86400000) {
        run++;
      } else {
        run = 1;
      }
      longestStreak = Math.max(longestStreak, run);
      prev = d;
    }

    // ─── Totals (last 30 days) ───
    const monthAgo = daysAgo(30);
    const [totals] = await Activity.aggregate([
      { $match: { userId, createdAt: { $gte: monthAgo } } },
      {
        $group: {
          _id: null,
          runs: { $sum: { $cond: [{ $eq: ['$type', 'run'] }, 1, 0] } },
          lines: { $sum: '$linesOfCode' },
          rooms: {
            $sum: {
              $cond: [{ $in: ['$type', ['room_join', 'room_create']] }, 1, 0],
            },
          },
        },
      },
    ]);

    // ─── Language distribution (last 30 days) ───
    const languages = await Activity.aggregate([
      { $match: { userId, type: 'run', createdAt: { $gte: monthAgo } } },
      { $group: { _id: '$language', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    // ─── Weekly runs (last 12 weeks, for bar chart) ───
    const twelveWeeksAgo = daysAgo(84);
    const weekly = await Activity.aggregate([
      { $match: { userId, type: 'run', createdAt: { $gte: twelveWeeksAgo } } },
      {
        $group: {
          _id: {
            $dateToString: {
              format: '%Y-%U',
              date: '$createdAt',
            },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    res.json({
      heatmap,
      streaks: { current: currentStreak, longest: longestStreak },
      totals: {
        runs: totals?.runs || 0,
        lines: totals?.lines || 0,
        rooms: totals?.rooms || 0,
      },
      languages: languages.filter((l) => l._id).map((l) => ({ name: l._id, count: l.count })),
      weekly: weekly.map((w) => ({ week: w._id, count: w.count })),
    });
  } catch (err) {
    console.error('[analytics]', err.message);
    res.status(500).json({ error: 'Could not load analytics.' });
  }
});

module.exports = router;
