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

  CREATE TABLE IF NOT EXISTS task_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS client_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id TEXT NOT NULL,
    template_id UUID REFERENCES task_templates(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'done')),
    due_date DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS page_content (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id TEXT NOT NULL,
    page TEXT NOT NULL,
    header TEXT,
    announcement TEXT,
    UNIQUE(client_id, page)
  );

  CREATE TABLE IF NOT EXISTS client_labels (
    client_id TEXT PRIMARY KEY,
    label TEXT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  -- Stage grouping + tags for tasks (LaunchBay-style task board)
  ALTER TABLE task_templates ADD COLUMN IF NOT EXISTS stage TEXT;
  ALTER TABLE task_templates ADD COLUMN IF NOT EXISTS tag TEXT;
  ALTER TABLE task_templates ADD COLUMN IF NOT EXISTS stage_order INT NOT NULL DEFAULT 0;
  ALTER TABLE task_templates ADD COLUMN IF NOT EXISTS sort_order INT NOT NULL DEFAULT 0;

  ALTER TABLE client_tasks ADD COLUMN IF NOT EXISTS stage TEXT;
  ALTER TABLE client_tasks ADD COLUMN IF NOT EXISTS tag TEXT;
  ALTER TABLE client_tasks ADD COLUMN IF NOT EXISTS stage_order INT NOT NULL DEFAULT 0;
  ALTER TABLE client_tasks ADD COLUMN IF NOT EXISTS sort_order INT NOT NULL DEFAULT 0;

  -- Rich-text notes on tasks
  ALTER TABLE task_templates ADD COLUMN IF NOT EXISTS notes TEXT;
  ALTER TABLE client_tasks ADD COLUMN IF NOT EXISTS notes TEXT;

  -- File attachments on tasks (private Vercel Blob)
  CREATE TABLE IF NOT EXISTS task_attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scope TEXT NOT NULL CHECK (scope IN ('template','client_task')),
    ref_id TEXT NOT NULL,
    client_id TEXT,
    file_name TEXT NOT NULL,
    pathname TEXT NOT NULL,
    url TEXT NOT NULL,
    content_type TEXT,
    size BIGINT,
    uploaded_by TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  CREATE INDEX IF NOT EXISTS idx_task_attachments_ref ON task_attachments (scope, ref_id);

  -- Link tasks to a FileFlow intake form + store answers locally
  ALTER TABLE task_templates ADD COLUMN IF NOT EXISTS form_key TEXT;
  ALTER TABLE client_tasks ADD COLUMN IF NOT EXISTS form_key TEXT;
  CREATE TABLE IF NOT EXISTS form_responses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id TEXT NOT NULL,
    form_key TEXT NOT NULL,
    field_key TEXT NOT NULL,
    value TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (client_id, form_key, field_key)
  );
  CREATE INDEX IF NOT EXISTS idx_form_responses_client_form ON form_responses (client_id, form_key);

  -- Richer editable page content (admin-managed: embed, body, image)
  ALTER TABLE page_content ADD COLUMN IF NOT EXISTS embed_url TEXT;
  ALTER TABLE page_content ADD COLUMN IF NOT EXISTS body TEXT;
  ALTER TABLE page_content ADD COLUMN IF NOT EXISTS image_pathname TEXT;
  ALTER TABLE page_content ADD COLUMN IF NOT EXISTS image_name TEXT;
  ALTER TABLE page_content ADD COLUMN IF NOT EXISTS image_url TEXT;
  ALTER TABLE page_content ADD COLUMN IF NOT EXISTS embed_height INT;

  -- Inline images embedded inside rich-text content (private blob)
  CREATE TABLE IF NOT EXISTS content_images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pathname TEXT NOT NULL,
    url TEXT NOT NULL,
    uploaded_by TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  -- Admin-created custom portal pages + per-client page visibility
  CREATE TABLE IF NOT EXISTS custom_pages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    position INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  CREATE TABLE IF NOT EXISTS client_page_prefs (
    client_id TEXT NOT NULL,
    page_key TEXT NOT NULL,
    hidden BOOLEAN NOT NULL DEFAULT false,
    PRIMARY KEY (client_id, page_key)
  );

  -- Nav label overrides (rename built-in pages)
  CREATE TABLE IF NOT EXISTS page_labels (
    page_key TEXT PRIMARY KEY,
    label TEXT NOT NULL
  );

  -- File attachments on messages (private blob)
  CREATE TABLE IF NOT EXISTS message_attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id UUID NOT NULL,
    client_id TEXT NOT NULL,
    file_name TEXT NOT NULL,
    pathname TEXT NOT NULL,
    url TEXT NOT NULL,
    content_type TEXT,
    size BIGINT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  CREATE INDEX IF NOT EXISTS idx_message_attachments_msg ON message_attachments (message_id);

  -- Drive dropzone uploads + dismissed dashboard activity
  CREATE TABLE IF NOT EXISTS dropzone_files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    file_name TEXT NOT NULL,
    pathname TEXT NOT NULL,
    url TEXT NOT NULL,
    drive_status TEXT NOT NULL DEFAULT 'pending',
    uploaded_by TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  CREATE TABLE IF NOT EXISTS dismissed_activity (
    event_id TEXT PRIMARY KEY,
    dismissed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  -- Per-client portal preferences (Settings page: theme + joke of the day)
  CREATE TABLE IF NOT EXISTS client_prefs (
    client_id TEXT PRIMARY KEY,
    theme TEXT NOT NULL DEFAULT 'classic',
    show_joke BOOLEAN NOT NULL DEFAULT false,
    light_text BOOLEAN NOT NULL DEFAULT false,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );

  -- AI-reformatted calendar event notes (cache; keyed by Airtable event record id)
  CREATE TABLE IF NOT EXISTS event_note_ai (
    event_id TEXT PRIMARY KEY,
    source_hash TEXT NOT NULL,
    html TEXT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );

  -- per-conversation "text me when this client replies" switch (admin)
  CREATE TABLE IF NOT EXISTS admin_sms_watch (
    client_id TEXT PRIMARY KEY,
    enabled BOOLEAN NOT NULL DEFAULT true,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );

  -- small key/value settings (e.g. admin_notify_phone)
  CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );

  -- how a firm message was delivered: null=portal only, notification=text alert sent, full=message texted
  ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS sms_status TEXT;
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
