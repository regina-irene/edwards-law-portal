// lib/form-review.ts - the portal's own "a client has filled something in"
// signal, so it does not depend on anyone reading their email (2026-08-22).
//
// Modelled on unread messages, and read the same way: a count on the dashboard
// that means "somebody has answered something you have not looked at", and
// clears itself when you open the answers. No button to press, nothing to keep
// tidy.
//
// "Reviewed" is a timestamp per client + form, held in the existing
// app_settings key/value table, so this needs no migration. A form counts as
// waiting when its newest answer is newer than the last time an admin opened
// that client's copy - so a client coming back next week to add three more
// answers puts it back on the list, which is the behaviour you want.
import { sql } from "@/lib/db"

const KEY_PREFIX = "form_reviewed:"

function key(clientId: string, formKey: string): string {
  return `${KEY_PREFIX}${clientId}:${formKey}`
}

/**
 * How many client forms have answers nobody at the firm has looked at since.
 *
 * Returns 0 rather than throwing: a dashboard tile is not worth failing the
 * whole page for, and a wrong zero reads as "nothing waiting", which is the
 * safe direction for a number that is only ever a prompt to go and look.
 */
export async function countFormsAwaitingReview(): Promise<number> {
  try {
    const r = await sql`
      SELECT COUNT(*)::int AS c FROM (
        SELECT client_id, form_key, MAX(updated_at) AS newest
        FROM form_responses
        WHERE COALESCE(value, '') <> ''
        GROUP BY client_id, form_key
      ) f
      LEFT JOIN app_settings s
        ON s.key = ${KEY_PREFIX} || f.client_id || ':' || f.form_key
      WHERE s.value IS NULL OR s.value::timestamptz < f.newest
    `
    return r.rows[0]?.c ?? 0
  } catch {
    return 0
  }
}

/**
 * Record that an admin has just looked at this client's answers.
 *
 * Called from the page that shows them, so the count clears by being read
 * rather than by being dismissed. Swallows its own errors - failing to record
 * a look means the tile stays lit, which is merely annoying; failing the page
 * would hide the answers she came to read.
 */
export async function markFormReviewed(clientId: string, formKey: string): Promise<void> {
  try {
    await sql`
      INSERT INTO app_settings (key, value, updated_at)
      VALUES (${key(clientId, formKey)}, ${new Date().toISOString()}, now())
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()
    `
  } catch (e) {
    console.error("[form-review] mark failed:", e instanceof Error ? e.message : e)
  }
}

/**
 * Which of these clients' answers to `formKey` are still unread, so the list
 * of respondents can mark them. One query for the whole list rather than one
 * per row.
 */
export async function unreviewedClientIds(formKey: string): Promise<Set<string>> {
  try {
    const r = await sql`
      SELECT f.client_id FROM (
        SELECT client_id, MAX(updated_at) AS newest
        FROM form_responses
        WHERE form_key = ${formKey} AND COALESCE(value, '') <> ''
        GROUP BY client_id
      ) f
      LEFT JOIN app_settings s
        ON s.key = ${KEY_PREFIX} || f.client_id || ':' || ${formKey}
      WHERE s.value IS NULL OR s.value::timestamptz < f.newest
    `
    return new Set(r.rows.map((row) => String(row.client_id)))
  } catch {
    return new Set()
  }
}

/** Per form key, how many clients have answers nobody has read. */
export async function unreviewedCountByForm(): Promise<Record<string, number>> {
  try {
    const r = await sql`
      SELECT f.form_key, COUNT(*)::int AS c FROM (
        SELECT client_id, form_key, MAX(updated_at) AS newest
        FROM form_responses
        WHERE COALESCE(value, '') <> ''
        GROUP BY client_id, form_key
      ) f
      LEFT JOIN app_settings s
        ON s.key = ${KEY_PREFIX} || f.client_id || ':' || f.form_key
      WHERE s.value IS NULL OR s.value::timestamptz < f.newest
      GROUP BY f.form_key
    `
    const out: Record<string, number> = {}
    for (const row of r.rows) out[String(row.form_key)] = Number(row.c) || 0
    return out
  } catch {
    return {}
  }
}
