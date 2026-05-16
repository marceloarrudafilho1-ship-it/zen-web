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
import aiRouter from './ai.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SPA_DIST = path.join(ROOT, 'dist');

const app = express();

// Default helmet CSP is too strict for the SPA pulling remote APIs
// (Etherscan, Helius, web3.bio, etc.).
app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
// Compress everything except SSE streams — buffering would defeat the whole
// point of streaming, and Express's default compression filter doesn't know
// about text/event-stream.
app.use(compression({
  filter: (req, res) => {
    if (req.path.startsWith('/api/ai/')) return false;
    return compression.filter(req, res);
  },
}));
app.use(express.json({ limit: '256kb' })); // wallet summaries can run a bit over the old 64kb cap
app.use(cookieParser());
app.use(attachUser);

// Railway's deploy readiness probe.
app.get('/healthz', (_req, res) => res.json({ ok: true }));

// Auth + per-user key management.
app.use('/api/auth', authRouter);

// AI features (gated by users.ai_enabled and ANTHROPIC_API_KEY).
app.use('/api/ai', aiRouter);

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
