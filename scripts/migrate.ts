import { Pool } from "pg"

export const MIGRATION_SQL = `
  -- Auth.js required tables
  CREATE TABLE IF NOT EXISTS users (
    id TEXT NOT NULL DEFAULT gen_random_uuid()::TEXT PRIMARY KEY,
    name TEXT,
    email TEXT NOT NULL,
    "emailVerified" TIMESTAMPTZ,
    image TEXT
  );

  CREATE TABLE IF NOT EXISTS accounts (
    id TEXT NOT NULL DEFAULT gen_random_uuid()::TEXT,
    "userId" TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    provider TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    refresh_token TEXT,
    access_token TEXT,
    expires_at INTEGER,
    token_type TEXT,
    scope TEXT,
    id_token TEXT,
    session_state TEXT,
    PRIMARY KEY (provider, "providerAccountId")
  );

  CREATE TABLE IF NOT EXISTS sessions (
    "sessionToken" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires TIMESTAMPTZ NOT NULL
  );

  CREATE TABLE IF NOT EXISTS verification_tokens (
    identifier TEXT NOT NULL,
    token TEXT NOT NULL,
    expires TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (identifier, token)
  );

  -- Portal-specific tables
  CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id TEXT NOT NULL,
    body TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    read BOOLEAN NOT NULL DEFAULT false
  );

  CREATE TABLE IF NOT EXISTS chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id TEXT NOT NULL,
    sender TEXT NOT NULL CHECK (sender IN ('client', 'firm')),
    body TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    read BOOLEAN NOT NULL DEFAULT false
  );

  CREATE TABLE IF NOT EXISTS nav_order (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pages JSONB NOT NULL
  );

  CREATE TABLE IF NOT EXISTS admin_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL UNIQUE,
    name TEXT
  );
`

async function migrate(): Promise<void> {
  const pool = new Pool({
    connectionString: process.env.POSTGRES_URL_NON_POOLING,
    ssl: { rejectUnauthorized: false },
  })

  const client = await pool.connect()
  try {
    await client.query(MIGRATION_SQL)
    console.log("Migration complete.")
  } finally {
    client.release()
    await pool.end()
  }
}

migrate().catch((err) => {
  console.error(err)
  process.exit(1)
})
