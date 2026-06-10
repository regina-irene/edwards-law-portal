// lib/client-prefs.ts — per-client portal preferences (theme + joke of the
// day), stored in the client_prefs table and edited on the client Settings page.
import { sql } from "@/lib/db"

export interface ClientPrefs {
  theme: string
  showJoke: boolean
}

const DEFAULTS: ClientPrefs = { theme: "classic", showJoke: false }

export async function getClientPrefs(clientId: string): Promise<ClientPrefs> {
  try {
    const r = await sql`SELECT theme, show_joke FROM client_prefs WHERE client_id = ${String(clientId)} LIMIT 1`
    if (r.rows.length === 0) return DEFAULTS
    return { theme: r.rows[0].theme ?? "classic", showJoke: Boolean(r.rows[0].show_joke) }
  } catch {
    return DEFAULTS
  }
}

export async function saveClientPrefs(clientId: string, prefs: ClientPrefs): Promise<void> {
  await sql`
    INSERT INTO client_prefs (client_id, theme, show_joke, updated_at)
    VALUES (${String(clientId)}, ${prefs.theme}, ${prefs.showJoke}, now())
    ON CONFLICT (client_id)
    DO UPDATE SET theme = EXCLUDED.theme, show_joke = EXCLUDED.show_joke, updated_at = now()
  `
}
