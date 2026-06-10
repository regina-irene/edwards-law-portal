// lib/app-settings.ts — small key/value settings (app_settings table).
import { sql } from "@/lib/db"

export async function getSetting(key: string): Promise<string> {
  try {
    const r = await sql`SELECT value FROM app_settings WHERE key = ${key} LIMIT 1`
    return (r.rows[0]?.value ?? "").trim()
  } catch {
    return ""
  }
}

export async function setSetting(key: string, value: string): Promise<void> {
  await sql`
    INSERT INTO app_settings (key, value, updated_at)
    VALUES (${key}, ${value.trim()}, now())
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()
  `
}
