// Express entry — serves the React SPA at the root plus the auth/keys API.
// There's no separate marketing landing page anymore: every browser request
// hits the SPA, which gates with AuthGate (login form vs. dashboard).

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
const SPA_DIST = path.join(ROOT, 'dist');

const app = express();

// Default helmet CSP is too strict for the SPA pulling remote APIs
// (Etherscan, Helius, web3.bio, etc.).
app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
app.use(compression());
app.use(express.json({ limit: '64kb' }));
app.use(cookieParser());
app.use(attachUser);

// Railway's deploy readiness probe.
app.get('/healthz', (_req, res) => res.json({ ok: true }));

// Auth + per-user key management.
app.use('/api/auth', authRouter);

// Static assets emitted by Vite live under dist/assets — serve them at
// /assets, plus any other static file (logos, etc.).
app.use(express.static(SPA_DIST, { index: false, maxAge: '1h' }));

// Everything else returns the SPA shell. /app, /login, deep links, the old
// landing URL — all resolve to index.html and AuthGate decides what renders.
app.get('*', (_req, res) => {
  res.sendFile(path.join(SPA_DIST, 'index.html'));
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
