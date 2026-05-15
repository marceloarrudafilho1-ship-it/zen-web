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

// One-shot schema setup. Idempotent on the new schema; if an older deploy
// created the email-based table, the DO block detects that and drops it so
// the CREATE below can rebuild fresh. After the first deploy with this code
// nothing destructive runs.
export async function migrate() {
  if (!process.env.DATABASE_URL) return;
  await pool.query(`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'email'
      ) THEN
        DROP TABLE users CASCADE;
        RAISE NOTICE 'Dropped legacy email-based users table';
      END IF;
    END $$;

    CREATE TABLE IF NOT EXISTS users (
      id            SERIAL PRIMARY KEY,
      username      TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      api_keys      JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  console.log('[db] migration complete');
}
