// OSINT Dog proxy — premium-only access to the universal-search endpoint
// (https://osintdog.com/api/search). Each premium user supplies their OWN
// OSINT Dog API key in Settings; the server reads it from users.api_keys and
// forwards the request with the X-API-Key header so the key never lands in
// the browser's network log.
//
// Universal search covers LeakCheck + HackCheck through one call. The
// request body shape is { field: [{ <type>: <value> }] } with type ∈
// {email, username, phone, domain, ip}.

import { Router } from 'express';
import { requireAi } from './auth.js';
import { pool } from './db.js';

const router = Router();
const OSINTDOG_BASE = 'https://osintdog.com';

const ALLOWED_TYPES = new Set(['email', 'username', 'phone', 'domain', 'ip']);

router.post('/search', requireAi, async (req, res) => {
  const type = String(req.body?.type || '');
  const value = String(req.body?.value || '').trim();

  if (!ALLOWED_TYPES.has(type)) {
    return res.status(400).json({
      error: 'Invalid search type. Use email, username, phone, domain, or ip.',
    });
  }
  if (!value) {
    return res.status(400).json({ error: 'Search value is required.' });
  }

  try {
    // Pull this user's OSINT Dog key out of the JSONB column. `->>` returns
    // text (the inner string) rather than a JSON-typed value with quotes.
    const { rows } = await pool.query(
      "SELECT api_keys ->> 'osintdog' AS key FROM users WHERE id = $1",
      [req.user.uid],
    );
    const key = rows[0]?.key;
    if (!key) {
      return res.status(400).json({
        error: 'No OSINT Dog API key configured. Add one in Settings.',
      });
    }

    const upstream = await fetch(`${OSINTDOG_BASE}/api/search`, {
      method: 'POST',
      headers: {
        'X-API-Key': key,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({ field: [{ [type]: value }] }),
    });

    const text = await upstream.text();
    let data;
    try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }

    if (!upstream.ok) {
      // Pass through the upstream status so the SPA can show specific
      // messaging (401 = bad key, 403 = blacklisted term, 429 = rate limit).
      return res.status(upstream.status).json({
        error: data?.detail || data?.error || `OSINT Dog returned HTTP ${upstream.status}`,
      });
    }
    return res.json({ provider: 'osintdog', type, value, response: data });
  } catch (err) {
    console.error('[osintdog] search failed:', err);
    return res.status(502).json({ error: err.message || 'OSINT Dog search failed' });
  }
});

export default router;
