const express = require('express');
const authMiddleware = require('../middleware/auth');
const { typecheckFiles } = require('../services/typecheck');

const router = express.Router();




router.post('/typecheck', authMiddleware, async (req, res) => {
  try {
    const { files } = req.body || {};

    if (!Array.isArray(files) || files.length === 0) {
      return res.status(400).json({ error: 'files array is required' });
    }

    const valid = files.filter(
      (f) => f && typeof f.path === 'string' && typeof f.content === 'string'
    );
    if (!valid.length) {
      return res.status(400).json({ error: 'files array is required' });
    }

    const diagnostics = await typecheckFiles(valid);
    res.json({ diagnostics });
  } catch (err) {
    console.error('Typecheck error:', err?.message || err);
    res.status(500).json({ error: err?.message || 'Type check failed' });
  }
});

module.exports = router;
