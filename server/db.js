// Postgres connection pool. Railway provides DATABASE_URL via its Postgres
// plugin and requires SSL — rejectUnauthorized:false because the cert chain
// isn't always present in their managed instance.

import pkg from 'pg';
import 'dotenv/config';

const { Pool } = pkg;

if (!process.env.DATABASE_URL) {
  console.warn('[db] DATABASE_URL is not set — auth endpoints will fail until it is configured.');
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('railway') || process.env.NODE_ENV === 'production'
    ? { rejectUnauthorized: false }
    : false,
});

// One-shot schema setup. Idempotent so it's safe to call on every cold start.
export async function migrate() {
  if (!process.env.DATABASE_URL) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id           SERIAL PRIMARY KEY,
      email        TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  console.log('[db] migration complete');
}
