// Auth routes — signup gated by INVITE_CODE, login via email+password.
// Sessions are stateless JWTs in an httpOnly cookie. No server-side session
// store needed, which keeps Railway deploys simple.

import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool } from './db.js';

const router = Router();
const COOKIE_NAME = 'zen_session';
const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 14; // 14 days

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
  return jwt.sign({ uid: user.id, email: user.email }, getSecret(), {
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

function normaliseEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function passwordOk(pw) {
  return typeof pw === 'string' && pw.length >= 8 && pw.length <= 200;
}

router.post('/signup', async (req, res) => {
  try {
    const email = normaliseEmail(req.body?.email);
    const password = req.body?.password;
    const inviteCode = String(req.body?.inviteCode || '');

    if (!email || !email.includes('@')) {
      return res.status(400).json({ error: 'Valid email is required.' });
    }
    if (!passwordOk(password)) {
      return res.status(400).json({ error: 'Password must be 8–200 characters.' });
    }

    const expected = process.env.INVITE_CODE;
    if (!expected) {
      return res.status(503).json({ error: 'Signups are disabled — server has no INVITE_CODE configured.' });
    }
    if (inviteCode !== expected) {
      return res.status(403).json({ error: 'Invalid invite code.' });
    }

    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rowCount > 0) {
      return res.status(409).json({ error: 'An account with that email already exists.' });
    }

    const hash = await bcrypt.hash(password, 12);
    const { rows } = await pool.query(
      'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email',
      [email, hash],
    );
    const user = rows[0];

    setSessionCookie(res, signTokenForUser(user));
    return res.json({ user: { id: user.id, email: user.email } });
  } catch (err) {
    console.error('[auth] signup failed:', err);
    return res.status(500).json({ error: 'Server error during signup.' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const email = normaliseEmail(req.body?.email);
    const password = req.body?.password;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const { rows } = await pool.query(
      'SELECT id, email, password_hash FROM users WHERE email = $1',
      [email],
    );
    const user = rows[0];
    // Uniform response timing to avoid leaking which side of the check failed.
    const ok = user ? await bcrypt.compare(password, user.password_hash) : false;
    if (!ok) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    setSessionCookie(res, signTokenForUser(user));
    return res.json({ user: { id: user.id, email: user.email } });
  } catch (err) {
    console.error('[auth] login failed:', err);
    return res.status(500).json({ error: 'Server error during login.' });
  }
});

router.post('/logout', (_req, res) => {
  clearSessionCookie(res);
  return res.json({ ok: true });
});

router.get('/me', (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  return res.json({ user: { id: req.user.uid, email: req.user.email } });
});

export default router;
