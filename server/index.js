// Express entry. Two top-level surfaces share the same origin:
//   /        → static marketing landing page (zen-web/landing)
//   /app/*   → React SPA (Vite build → zen-web/dist) — gated by AuthGate
//   /api/*   → auth + key-management JSON endpoints
// Same origin means session cookies cover both /app and /api without CORS.

import express from 'express';
import cookieParser from 'cookie-parser';
import compression from 'compression';
import helmet from 'helmet';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import 'dotenv/config';

import { migrate } from './db.js';
import authRouter, { attachUser } from './auth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const LANDING = path.join(ROOT, 'landing');
const SPA_DIST = path.join(ROOT, 'dist');

const app = express();

// helmet's default CSP is too strict for the landing page's external font CDN
// and for the SPA pulling remote APIs (Etherscan, Helius, web3.bio, ...).
app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
app.use(compression());
app.use(express.json({ limit: '64kb' }));
app.use(cookieParser());
app.use(attachUser);

// Health probe Railway uses for deploy readiness.
app.get('/healthz', (_req, res) => res.json({ ok: true }));

// Auth + per-user key management.
app.use('/api/auth', authRouter);

// ── SPA (must come before the landing static, because /app needs the dist
//    folder, and we don't want it shadowed by an accidental file under
//    /landing/app/). The index-html fallback serves SPA routes like /app/login.
app.use('/app', express.static(SPA_DIST, { index: false, maxAge: '1h' }));
app.get(/^\/app(\/.*)?$/, (_req, res) => {
  res.sendFile(path.join(SPA_DIST, 'index.html'));
});

// ── Landing (static marketing page) at the root.
app.get('/', (_req, res) => res.sendFile(path.join(LANDING, 'index.html')));
app.use('/', express.static(LANDING, { index: false, maxAge: '1h' }));

// Fallback: anything that hasn't matched above goes to the landing — friendlier
// than a bare 404, and won't accidentally break SPA deep links (those start
// with /app and are handled above).
app.get('*', (_req, res) => {
  res.status(404).sendFile(path.join(LANDING, 'index.html'));
});

const PORT = Number(process.env.PORT) || 3001;

async function start() {
  try {
    await migrate();
  } catch (err) {
    console.error('[boot] migration failed — continuing without db:', err.message);
  }
  app.listen(PORT, () => {
    console.log(`[boot] zen-web listening on :${PORT}`);
  });
}

start();
