const express = require('express');
const authMiddleware = require('../middleware/auth');
const Snippet = require('../models/Snippet');
const { BUILT_IN_SNIPPETS } = require('../data/builtinSnippets');

const router = express.Router();
router.use(authMiddleware);

function getUserId(req) {
  return String(req.user.userId || req.user.id || '');
}


async function ensureSeeded() {
  const count = await Snippet.countDocuments({ isBuiltIn: true });
  if (count === 0) {
    await Snippet.insertMany(
      BUILT_IN_SNIPPETS.map((s) => ({ ...s, isBuiltIn: true, userId: null }))
    );
    console.log(`[snippets] seeded ${BUILT_IN_SNIPPETS.length} built-in snippets`);
  }
}
ensureSeeded().catch((e) => console.error('[snippets] seed error:', e.message));


router.get('/', async (req, res) => {
  try {
    const userId = getUserId(req);
    const { language, q, category } = req.query;
    const filter = {
      $or: [{ isBuiltIn: true }, { userId }],
    };
    if (language) filter.language = language;
    if (category) filter.category = category;
    if (q) {
      const safe = String(q).slice(0, 50).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.$and = [
        {
          $or: [
            { name: { $regex: safe, $options: 'i' } },
            { prefix: { $regex: safe, $options: 'i' } },
            { description: { $regex: safe, $options: 'i' } },
          ],
        },
      ];
    }
    const items = await Snippet.find(filter).sort({ isBuiltIn: 1, useCount: -1, name: 1 }).lean();
    res.json({ snippets: items });
  } catch (err) {
    res.status(500).json({ error: 'Could not load snippets.' });
  }
});


router.post('/', async (req, res) => {
  try {
    const { name, prefix, language, category, description, code } = req.body || {};
    if (!name || !prefix || !language || !code) {
      return res.status(400).json({ error: 'name, prefix, language, code are required.' });
    }
    const snippet = await Snippet.create({
      userId: getUserId(req),
      name: String(name).slice(0, 80),
      prefix: String(prefix).slice(0, 32).replace(/\s+/g, ''),
      language: String(language).slice(0, 24),
      category: String(category || 'custom').slice(0, 32),
      description: String(description || '').slice(0, 200),
      code: String(code).slice(0, 8000),
      isBuiltIn: false,
    });
    res.status(201).json({ snippet });
  } catch (err) {
    res.status(500).json({ error: 'Could not create snippet.' });
  }
});


router.put('/:id', async (req, res) => {
  try {
    const snippet = await Snippet.findOne({ _id: req.params.id, userId: getUserId(req) });
    if (!snippet) return res.status(404).json({ error: 'Snippet not found.' });
    if (snippet.isBuiltIn) return res.status(403).json({ error: 'Built-in snippets cannot be edited.' });
    const { name, prefix, language, category, description, code } = req.body || {};
    if (name) snippet.name = String(name).slice(0, 80);
    if (prefix) snippet.prefix = String(prefix).slice(0, 32).replace(/\s+/g, '');
    if (language) snippet.language = String(language).slice(0, 24);
    if (category) snippet.category = String(category).slice(0, 32);
    if (description !== undefined) snippet.description = String(description).slice(0, 200);
    if (code) snippet.code = String(code).slice(0, 8000);
    await snippet.save();
    res.json({ snippet });
  } catch (err) {
    res.status(500).json({ error: 'Could not update snippet.' });
  }
});


router.delete('/:id', async (req, res) => {
  try {
    const result = await Snippet.deleteOne({
      _id: req.params.id,
      userId: getUserId(req),
      isBuiltIn: false,
    });
    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'Snippet not found.' });
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Could not delete snippet.' });
  }
});


router.post('/:id/use', async (req, res) => {
  try {
    await Snippet.updateOne({ _id: req.params.id }, { $inc: { useCount: 1 } });
    res.json({ ok: true });
  } catch {
    res.json({ ok: true });
  }
});

module.exports = router;
