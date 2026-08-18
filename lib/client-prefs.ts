// lib/client-prefs.ts — per-client portal preferences (color scheme + joke
// of the day), stored in the client_prefs table and edited on the client
// Settings page. The scheme reuses the old `theme` column; legacy values
// ('classic', old wallpaper keys) normalize to the default navy scheme.
import { sql } from "@/lib/db"
import { getScheme, DEFAULT_SCHEME_KEY } from "@/lib/color-schemes"

export interface ClientPrefs {
  showJoke: boolean
  scheme: string
  gradient: boolean
}

const DEFAULTS: ClientPrefs = { showJoke: false, scheme: DEFAULT_SCHEME_KEY, gradient: false }

export async function getClientPrefs(clientId: string): Promise<ClientPrefs> {
  try {
    const r = await sql`SELECT show_joke, theme, gradient FROM client_prefs WHERE client_id = ${String(clientId)} LIMIT 1`
    if (r.rows.length === 0) return DEFAULTS
    return {
      showJoke: Boolean(r.rows[0].show_joke),
      scheme: getScheme(r.rows[0].theme ? String(r.rows[0].theme) : null).key,
      gradient: Boolean(r.rows[0].gradient),
    }
  } catch {
    return DEFAULTS
  }
}

export async function saveClientPrefs(clientId: string, prefs: ClientPrefs): Promise<void> {
  await sql`
    INSERT INTO client_prefs (client_id, theme, show_joke, gradient, light_text, updated_at)
    VALUES (${String(clientId)}, ${prefs.scheme}, ${prefs.showJoke}, ${prefs.gradient}, false, now())
    ON CONFLICT (client_id)
    DO UPDATE SET theme = EXCLUDED.theme, show_joke = EXCLUDED.show_joke,
                  gradient = EXCLUDED.gradient, updated_at = now()
  `
}
