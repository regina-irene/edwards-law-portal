// lib/sms-watch.ts — "text me when this client replies": per-conversation
// switch (admin_sms_watch) + the firm cell number it notifies (app_settings).
import { sql } from "@/lib/db"

export async function getWatch(clientId: string): Promise<boolean> {
  try {
    const r = await sql`SELECT enabled FROM admin_sms_watch WHERE client_id = ${String(clientId)} LIMIT 1`
    return Boolean(r.rows[0]?.enabled)
  } catch {
    return false
  }
}

export async function setWatch(clientId: string, enabled: boolean): Promise<void> {
  await sql`
    INSERT INTO admin_sms_watch (client_id, enabled, updated_at)
    VALUES (${String(clientId)}, ${enabled}, now())
    ON CONFLICT (client_id) DO UPDATE SET enabled = EXCLUDED.enabled, updated_at = now()
  `
}

export async function getAdminPhone(): Promise<string> {
  try {
    const r = await sql`SELECT value FROM app_settings WHERE key = 'admin_notify_phone' LIMIT 1`
    return (r.rows[0]?.value ?? "").trim()
  } catch {
    return ""
  }
}

export async function setAdminPhone(phone: string): Promise<void> {
  await sql`
    INSERT INTO app_settings (key, value, updated_at)
    VALUES ('admin_notify_phone', ${phone.trim()}, now())
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()
  `
}
