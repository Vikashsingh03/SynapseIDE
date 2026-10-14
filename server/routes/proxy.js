const express = require('express');
const axios = require('axios');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// POST /api/proxy — CORS-bypassing HTTP proxy for the in-IDE REST client.
// Body: { method, url, headers (object, optional), body (string, optional) }
// Returns: { status, statusText, headers, body (raw string), isJson, timeMs, sizeBytes }
// or { error } with an appropriate HTTP status.
//
// NOTE: localhost IS allowed on purpose — the dev uses this to test his own
// local APIs. Cloud metadata endpoints are blocked (SSRF guard).

const ALLOWED_METHODS = new Set([
  'GET',
  'POST',
  'PUT',
  'PATCH',
  'DELETE',
  'HEAD',
  'OPTIONS',
]);

// Cloud metadata endpoints — never fetch these via the proxy.
const BLOCKED_HOSTS = new Set(['169.254.169.254', 'metadata.google.internal']);

const MAX_BYTES = 2 * 1024 * 1024; // 2MB cap on upstream request/response

async function proxyRequest(req, res) {
  try {
    const { method, url, headers, body } = req.body || {};

    const m = String(method || '').toUpperCase();
    if (!ALLOWED_METHODS.has(m)) {
      return res.status(400).json({
        error: `Unsupported method. Use one of: ${[...ALLOWED_METHODS].join(', ')}`,
      });
    }

    let parsed;
    try {
      parsed = new URL(String(url || ''));
    } catch {
      return res.status(400).json({ error: 'Invalid URL' });
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return res
        .status(400)
        .json({ error: 'Only http:// and https:// URLs are allowed' });
    }
    if (BLOCKED_HOSTS.has(parsed.hostname.toLowerCase())) {
      return res
        .status(400)
        .json({ error: 'Blocked host: cloud metadata endpoints are not allowed' });
    }

    // Header passthrough minus hop-by-hop headers axios must set itself.
    const outHeaders = {};
    if (headers && typeof headers === 'object' && !Array.isArray(headers)) {
      for (const [k, v] of Object.entries(headers)) {
        const kl = String(k).toLowerCase();
        if (kl === 'host' || kl === 'content-length') continue;
        if (v === undefined || v === null) continue;
        outHeaders[String(k)] = String(v);
      }
    }

    const started = Date.now();
    const config = {
      method: m,
      url: parsed.toString(),
      headers: outHeaders,
      timeout: 30000,
      maxContentLength: MAX_BYTES,
      maxBodyLength: MAX_BYTES,
      validateStatus: () => true, // pass upstream status codes through untouched
      responseType: 'text', // keep bytes raw; no auto JSON parsing
      transformResponse: [(d) => d],
    };
    if (m !== 'GET' && m !== 'HEAD' && body !== undefined && body !== null) {
      config.data = body;
    }

    let resp;
    try {
      resp = await axios(config);
    } catch (err) {
      if (err && err.code === 'ECONNABORTED') {
        return res.status(504).json({ error: 'Upstream timed out (30s)' });
      }
      const msg = err?.message || 'Upstream request failed';
      if (msg.includes('maxContentLength') || msg.includes('maxBodyLength')) {
        return res.status(502).json({ error: 'Upstream response too large (2MB cap)' });
      }
      return res.status(502).json({ error: msg });
    }

    const bodyStr =
      typeof resp.data === 'string' ? resp.data : String(resp.data ?? '');
    let isJson = false;
    try {
      JSON.parse(bodyStr);
      isJson = true;
    } catch {
      // not JSON — isJson stays false
    }

    res.json({
      status: resp.status,
      statusText: resp.statusText || '',
      headers: resp.headers || {},
      body: bodyStr,
      isJson,
      timeMs: Date.now() - started,
      sizeBytes: Buffer.byteLength(bodyStr, 'utf8'),
    });
  } catch (err) {
    console.error('Proxy error:', err?.message || err);
    res.status(500).json({ error: err?.message || 'Proxy request failed' });
  }
}

router.post('/proxy', authMiddleware, proxyRequest);

module.exports = router;
// Exported for unit/smoke testing without going through express.
module.exports.proxyRequest = proxyRequest;
