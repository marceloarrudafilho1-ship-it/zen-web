// Express entry — serves the auth API plus the built Vite SPA. Single port,
// so the same Railway service handles both surfaces with no CORS to fuss with.

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
const DIST = path.join(ROOT, 'dist');

const app = express();

// helmet's default CSP is too strict for a Vite SPA that pulls remote APIs
// (Etherscan, Helius, CoinGecko, web3.bio, etc.). We disable CSP and keep the
// rest of the protections.
app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
app.use(compression());
app.use(express.json({ limit: '64kb' }));
app.use(cookieParser());
app.use(attachUser);

// Health check — useful for Railway's deploy probes.
app.get('/healthz', (_req, res) => res.json({ ok: true }));

app.use('/api/auth', authRouter);

// Anything else goes to the SPA. In dev Vite handles this itself; in prod
// Express serves dist/.
app.use(express.static(DIST, { index: false, maxAge: '1h' }));
app.get('*', (_req, res) => {
  res.sendFile(path.join(DIST, 'index.html'));
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
