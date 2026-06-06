import { sql } from "./db"

// Editable display-label overrides for clients on the admin list, keyed by the
// internal client ID. Falls back gracefully if the table doesn't exist yet.
export async function getClientLabels(): Promise<Record<string, string>> {
  try {
    const { rows } = await sql`SELECT client_id, label FROM client_labels`
    const map: Record<string, string> = {}
    for (const row of rows) map[row.client_id] = row.label
    return map
  } catch {
    return {}
  }
}

export async function setClientLabel(clientId: string, label: string): Promise<void> {
  await sql`
    INSERT INTO client_labels (client_id, label, updated_at)
    VALUES (${clientId}, ${label}, NOW())
    ON CONFLICT (client_id) DO UPDATE SET label = EXCLUDED.label, updated_at = NOW()
  `
}
