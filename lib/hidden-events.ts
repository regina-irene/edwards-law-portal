// lib/hidden-events.ts - activity entries the firm has taken off the Field
// Notes log (2026-08-20).
//
// The lighter rows on the running log are NOT stored records. They are drawn
// live from eight different tables every time the page renders: the
// conversation, the legacy message table, task attachments, message
// attachments, dropzone uploads, file views, form responses and tasks. There is
// no "timeline row" anywhere to delete.
//
// So hiding one is exactly that: hiding. The client's message stays in the
// Message Center, the document stays on its task and in Drive, the form
// response stays recorded. Only the log stops drawing that line. That is the
// right default for a case file - tidying a view must never quietly destroy
// material the firm might later have to produce - and it means every hide is
// reversible from the "Show hidden" toggle.
//
// Stored one row per hidden entry in the existing app_settings table, so this
// needs no migration. Event ids are stable and source-prefixed (chat-123,
// upload-456, view-task-789-2026-08-20), which is what makes them safe to use
// as keys.
import { sql } from "@/lib/db"

const KEY_PREFIX = "hidden_event:"

/** What was stored against a hidden entry, for the record. */
interface HiddenMeta {
  at: string
  by: string
}

function keyFor(eventId: string): string {
  return KEY_PREFIX + String(eventId)
}

/**
 * Every hidden entry id.
 *
 * Fails soft to an EMPTY set on any error, which means the log shows MORE than
 * it should rather than less. That is the safe direction: a database problem
 * must never make case activity silently vanish.
 */
export async function getHiddenEventIds(): Promise<Set<string>> {
  try {
    const r = await sql`SELECT key FROM app_settings WHERE key LIKE ${KEY_PREFIX + "%"}`
    return new Set(r.rows.map((row) => String(row.key).slice(KEY_PREFIX.length)))
  } catch {
    return new Set<string>()
  }
}

/** Take one entry off the log. Idempotent. */
export async function hideEvent(eventId: string, by: string): Promise<boolean> {
  const meta: HiddenMeta = { at: new Date().toISOString(), by }
  try {
    await sql`
      INSERT INTO app_settings (key, value, updated_at)
      VALUES (${keyFor(eventId)}, ${JSON.stringify(meta)}, now())
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()
    `
    return true
  } catch {
    return false
  }
}

/** Put it back. */
export async function unhideEvent(eventId: string): Promise<boolean> {
  try {
    await sql`DELETE FROM app_settings WHERE key = ${keyFor(eventId)}`
    return true
  } catch {
    return false
  }
}

/**
 * An event id worth writing to the database.
 *
 * The ids are built by lib/notes-timeline from a source prefix and a row id, so
 * anything without a prefix did not come from there. Length-capped because this
 * value arrives from the browser and becomes a primary key.
 */
export function isEventId(v: unknown): v is string {
  return typeof v === "string" && v.length > 0 && v.length <= 200 && /^[a-z]+-/.test(v)
}
