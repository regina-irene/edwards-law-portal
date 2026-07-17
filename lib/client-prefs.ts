// lib/client-prefs.ts — per-client portal preferences (joke of the day),
// stored in the client_prefs table and edited on the client Settings page.
// (Theme picking was removed 2026-07 — everyone gets the one navy/cream look.
// The old theme/light_text columns remain in the DB but are no longer read.)
import { sql } from "@/lib/db"

export interface ClientPrefs {
  showJoke: boolean
}

const DEFAULTS: ClientPrefs = { showJoke: false }

export async function getClientPrefs(clientId: string): Promise<ClientPrefs> {
  try {
    const r = await sql`SELECT show_joke FROM client_prefs WHERE client_id = ${String(clientId)} LIMIT 1`
    if (r.rows.length === 0) return DEFAULTS
    return { showJoke: Boolean(r.rows[0].show_joke) }
  } catch {
    return DEFAULTS
  }
}

export async function saveClientPrefs(clientId: string, prefs: ClientPrefs): Promise<void> {
  await sql`
    INSERT INTO client_prefs (client_id, theme, show_joke, light_text, updated_at)
    VALUES (${String(clientId)}, 'classic', ${prefs.showJoke}, false, now())
    ON CONFLICT (client_id)
    DO UPDATE SET show_joke = EXCLUDED.show_joke, updated_at = now()
  `
}
