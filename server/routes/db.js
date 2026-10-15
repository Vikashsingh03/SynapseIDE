



const express = require('express');
const mongoose = require('mongoose');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

const URI_PREFIXES = ['mongodb://', 'mongodb+srv://'];
const DB_NAME_RE = /^[A-Za-z0-9_-]+$/;
const COLL_NAME_RE = /^[A-Za-z0-9_.-]+$/;





function scrubUri(text) {
  return String(text == null ? '' : text)
    .replace(/mongodb(\+srv)?:\/\/[^@\s]+@/g, 'mongodb://***@')
    .replace(/mongodb(\+srv)?:\/\/\*\*\*@[^/\s?]+/g, 'mongodb://***@***')
    .replace(/mongodb(\+srv)?:\/\/[^/\s?]+/g, 'mongodb://***')
    .replace(/\b(\d{1,3}\.){3}\d{1,3}(:\d+)?\b/g, '***');
}

function scrubbedErr(err, fallback) {
  return scrubUri((err && err.message) || fallback || 'Database request failed');
}



function logErr(tag, err) {
  console.error(tag, scrubUri((err && err.code) || 'unknown'));
}

function validateUri(uri) {
  if (typeof uri !== 'string' || !URI_PREFIXES.some((p) => uri.startsWith(p))) {
    return 'Connection string must start with mongodb:// or mongodb+srv://';
  }
  return null;
}

async function openConnection(uri) {
  const conn = mongoose.createConnection(uri, {
    serverSelectionTimeoutMS: 6000,
    connectTimeoutMS: 6000,
    socketTimeoutMS: 15000,
  });
  await conn.asPromise();
  return conn;
}

async function withConn(uri, fn) {
  const conn = await openConnection(uri);
  try {
    return await fn(conn);
  } finally {
    await conn.close().catch(() => {});
  }
}

function getMongoClient(conn) {
  const client = conn.getClient();
  if (!client) throw new Error('MongoDB client is not connected');
  return client;
}




function bsonType(v, names) {
  if (!v || typeof v !== 'object') return false;
  const cn = (v.constructor && v.constructor.name) || '';
  return names.includes(cn) || names.includes(v._bsontype);
}

function bsonWalk(v) {
  if (v === null || v === undefined) return v;
  if (typeof v === 'bigint') return v.toString();
  if (v instanceof Date) return v.toISOString();
  if (Array.isArray(v)) return v.map(bsonWalk);
  if (typeof v === 'object') {
    if (bsonType(v, ['ObjectId', 'Decimal128', 'Long', 'UUID', 'Timestamp', 'BSONSymbol', 'Code', 'ObjectID']))
      return v.toString();
    if (bsonType(v, ['Double']))
      return typeof v.value === 'number' ? v.value : String(v);
    if (bsonType(v, ['Binary'])) {
      try {
        return `0x${Buffer.from(v.buffer).toString('hex')}`;
      } catch {
        return '[binary]';
      }
    }
    if (bsonType(v, ['MinKey'])) return 'MinKey';
    if (bsonType(v, ['MaxKey'])) return 'MaxKey';
    const out = {};
    for (const [k, val] of Object.entries(v)) out[k] = bsonWalk(val);
    return out;
  }
  return v;
}

function bsonSafe(value) {
  return bsonWalk(value);
}




router.post('/connect', authMiddleware, async (req, res) => {
  const { uri } = req.body || {};
  const invalid = validateUri(uri);
  if (invalid) return res.status(400).json({ error: invalid });
  try {
    const databases = await withConn(uri, async (conn) => {
      const admin = getMongoClient(conn).db('admin').admin();
      const { databases } = await admin.listDatabases();
      return databases
        .filter((d) => d && typeof d.name === 'string')
        .map((d) => ({ name: d.name, sizeOnDisk: d.sizeOnDisk || 0 }));
    });
    res.json({ ok: true, databases });
  } catch (err) {
    logErr('DB connect failed:', err);
    res.status(400).json({ error: scrubbedErr(err, 'Could not connect to the database') });
  }
});




router.post('/collections', authMiddleware, async (req, res) => {
  const { uri, db } = req.body || {};
  const invalid = validateUri(uri);
  if (invalid) return res.status(400).json({ error: invalid });
  if (typeof db !== 'string' || !DB_NAME_RE.test(db)) {
    return res.status(400).json({ error: 'Invalid database name' });
  }
  try {
    const collections = await withConn(uri, async (conn) => {
      const list = await getMongoClient(conn).db(db).listCollections({}, { nameOnly: true }).toArray();
      return list.map((c) => c.name).filter((n) => typeof n === 'string').sort();
    });
    res.json({ collections });
  } catch (err) {
    logErr('DB collections failed:', err);
    res.status(400).json({ error: scrubbedErr(err, 'Could not list collections') });
  }
});




router.post('/query', authMiddleware, async (req, res) => {
  const { uri, db, collection } = req.body || {};
  const invalid = validateUri(uri);
  if (invalid) return res.status(400).json({ error: invalid });
  if (typeof db !== 'string' || !DB_NAME_RE.test(db)) {
    return res.status(400).json({ error: 'Invalid database name' });
  }
  if (typeof collection !== 'string' || !COLL_NAME_RE.test(collection)) {
    return res.status(400).json({ error: 'Invalid collection name' });
  }
  let filter = {};
  const rawFilter = req.body.filter == null ? '{}' : req.body.filter;
  if (typeof rawFilter !== 'string') {
    return res.status(400).json({ error: 'filter must be a JSON string' });
  }
  try {
    filter = JSON.parse(rawFilter);
  } catch {
    return res.status(400).json({ error: 'filter is not valid JSON' });
  }
  if (filter == null || typeof filter !== 'object' || Array.isArray(filter)) {
    return res.status(400).json({ error: 'filter must be a JSON object' });
  }
  let limit = parseInt(req.body.limit, 10);
  if (!Number.isFinite(limit) || limit < 1) limit = 25;
  limit = Math.min(limit, 100);

  try {
    const documents = await withConn(uri, async (conn) => {
      const docs = await getMongoClient(conn)
        .db(db)
        .collection(collection)
        .find(filter)
        .limit(limit)
        .toArray();
      return bsonSafe(docs);
    });
    res.json({ documents, count: documents.length });
  } catch (err) {
    logErr('DB query failed:', err);
    res.status(400).json({ error: scrubbedErr(err, 'Query failed') });
  }
});

module.exports = router;
