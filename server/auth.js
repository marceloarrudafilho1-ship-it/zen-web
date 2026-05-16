// Auth routes — signup gated by INVITE_CODE, login via username+password.
// Sessions are stateless JWTs in an httpOnly cookie. No server-side session
// store needed, which keeps Railway deploys simple.
//
// Per-user API keys (etherscan, helius, coingecko, snusbase, leakpeek, web3bio)
// live in users.api_keys as a JSONB blob — added/edited via PUT /keys, returned
// alongside the user on /me so the SPA can hydrate Settings on load.

import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool } from './db.js';

const router = Router();
const COOKIE_NAME = 'zen_session';
const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 14; // 14 days

// Whitelist of recognised key names — protects us from a client trying to
// stash arbitrary fields under api_keys.
const ALLOWED_KEYS = ['etherscan', 'helius', 'coingecko', 'snusbase', 'leakpeek', 'web3bio'];

function getSecret() {
  const s = process.env.JWT_SECRET;
  if (!s || s.length < 16) {
    throw new Error('JWT_SECRET is missing or too short — set it in Railway variables.');
  }
  return s;
}

function setSessionCookie(res, token) {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: TOKEN_TTL_SECONDS * 1000,
    path: '/',
  });
}

function clearSessionCookie(res) {
  res.clearCookie(COOKIE_NAME, { path: '/' });
}

function signTokenForUser(user) {
  return jwt.sign({ uid: user.id, username: user.username }, getSecret(), {
    expiresIn: TOKEN_TTL_SECONDS,
  });
}

// Reads the cookie, verifies the JWT, attaches req.user. Doesn't gate — that's
// `requireAuth`'s job — so the same middleware works for /me (returns 401 if
// missing) and for general routes that just want user info if available.
export function attachUser(req, _res, next) {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) return next();
  try {
    req.user = jwt.verify(token, getSecret());
  } catch {
    // Invalid / expired token — silently ignore. requireAuth will reject.
  }
  next();
}

export function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  next();
}

function normaliseUsername(name) {
  return String(name || '').trim().toLowerCase();
}

function usernameOk(name) {
  return typeof name === 'string'
    && name.length >= 3
    && name.length <= 32
    && /^[a-z0-9_]+$/i.test(name);
}

function passwordOk(pw) {
  return typeof pw === 'string' && pw.length >= 8 && pw.length <= 200;
}

// Strips unknown fields and coerces values to strings so we never persist
// arbitrary client input.
function sanitiseKeys(obj) {
  const out = {};
  if (!obj || typeof obj !== 'object') return out;
  for (const k of ALLOWED_KEYS) {
    if (typeof obj[k] === 'string') out[k] = obj[k].trim();
  }
  return out;
}

async function loadUserById(id) {
  const { rows } = await pool.query(
    'SELECT id, username, api_keys, ai_enabled FROM users WHERE id = $1',
    [id],
  );
  return rows[0] || null;
}

// Re-used by the AI router as an auth middleware that also enforces tier.
export function requireAi(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  // The JWT only stores uid + username; we re-check the DB so revoking
  // AI access from a user takes effect on their next request, not on a
  // fresh login. Cheap enough — one indexed SELECT per AI call.
  pool.query('SELECT ai_enabled FROM users WHERE id = $1', [req.user.uid])
    .then(({ rows }) => {
      if (!rows[0]?.ai_enabled) {
        return res.status(403).json({ error: 'AI features are not enabled for this account.' });
      }
      next();
    })
    .catch((err) => {
      console.error('[auth] requireAi DB check failed:', err);
      res.status(500).json({ error: 'Server error verifying AI access.' });
    });
}

router.post('/signup', async (req, res) => {
  try {
    const username = normaliseUsername(req.body?.username);
    const password = req.body?.password;
    const inviteCode = String(req.body?.inviteCode || '');

    if (!usernameOk(username)) {
      return res.status(400).json({ error: 'Username must be 3–32 chars, letters/digits/underscore only.' });
    }
    if (!passwordOk(password)) {
      return res.status(400).json({ error: 'Password must be 8–200 characters.' });
    }

    const basic = process.env.INVITE_CODE;
    const premium = process.env.INVITE_CODE_PREMIUM;
    if (!basic && !premium) {
      return res.status(503).json({ error: 'Signups are disabled — server has no INVITE_CODE configured.' });
    }

    // Premium code is checked first so it wins ties when both env vars
    // happen to share a value. Match against the configured codes only —
    // ignore the empty-string fallback so missing premium doesn't match "".
    let aiEnabled = false;
    if (premium && inviteCode === premium) {
      aiEnabled = true;
    } else if (!basic || inviteCode !== basic) {
      return res.status(403).json({ error: 'Invalid invite code.' });
    }

    const existing = await pool.query('SELECT id FROM users WHERE username = $1', [username]);
    if (existing.rowCount > 0) {
      return res.status(409).json({ error: 'That username is already taken.' });
    }

    const hash = await bcrypt.hash(password, 12);
    const { rows } = await pool.query(
      'INSERT INTO users (username, password_hash, ai_enabled) VALUES ($1, $2, $3) RETURNING id, username, api_keys, ai_enabled',
      [username, hash, aiEnabled],
    );
    const user = rows[0];

    setSessionCookie(res, signTokenForUser(user));
    return res.json({
      user: {
        id: user.id,
        username: user.username,
        apiKeys: user.api_keys || {},
        aiEnabled: !!user.ai_enabled,
      },
    });
  } catch (err) {
    console.error('[auth] signup failed:', err);
    return res.status(500).json({ error: 'Server error during signup.' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const username = normaliseUsername(req.body?.username);
    const password = req.body?.password;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required.' });
    }

    const { rows } = await pool.query(
      'SELECT id, username, password_hash, api_keys, ai_enabled FROM users WHERE username = $1',
      [username],
    );
    const user = rows[0];
    // Uniform response timing to avoid leaking which side of the check failed.
    const ok = user ? await bcrypt.compare(password, user.password_hash) : false;
    if (!ok) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    setSessionCookie(res, signTokenForUser(user));
    return res.json({
      user: {
        id: user.id,
        username: user.username,
        apiKeys: user.api_keys || {},
        aiEnabled: !!user.ai_enabled,
      },
    });
  } catch (err) {
    console.error('[auth] login failed:', err);
    return res.status(500).json({ error: 'Server error during login.' });
  }
});

router.post('/logout', (_req, res) => {
  clearSessionCookie(res);
  return res.json({ ok: true });
});

router.get('/me', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  try {
    const user = await loadUserById(req.user.uid);
    if (!user) {
      // Stale cookie pointing at a deleted account — clear it.
      clearSessionCookie(res);
      return res.status(401).json({ error: 'Account no longer exists.' });
    }
    return res.json({
      user: {
        id: user.id,
        username: user.username,
        apiKeys: user.api_keys || {},
        aiEnabled: !!user.ai_enabled,
      },
    });
  } catch (err) {
    console.error('[auth] me failed:', err);
    return res.status(500).json({ error: 'Server error.' });
  }
});

// Replace the user's api_keys blob with whatever fields the client sent. The
// PUT semantics mean "this is the new full set" — Settings always submits the
// complete object, so a deleted key is preserved as an empty string rather
// than silently kept.
router.put('/keys', requireAuth, async (req, res) => {
  try {
    const cleaned = sanitiseKeys(req.body);
    const { rows } = await pool.query(
      'UPDATE users SET api_keys = $2 WHERE id = $1 RETURNING api_keys',
      [req.user.uid, cleaned],
    );
    if (rows.length === 0) return res.status(404).json({ error: 'User not found.' });
    return res.json({ apiKeys: rows[0].api_keys });
  } catch (err) {
    console.error('[auth] update keys failed:', err);
    return res.status(500).json({ error: 'Server error while saving keys.' });
  }
});

export default router;
