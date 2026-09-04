// lib/form-notify.ts - tell the firm when a client fills in a form
// (2026-08-22).
//
// A client could complete a whole form and nobody would know until somebody
// opened the Answers page. It showed on the activity feed, but only to whoever
// was looking at the time.
//
// RATE LIMITED, and that is the whole design problem. The form saves through a
// Save button the client presses whenever they like, so a careful client
// filling in forty questions over an afternoon might press it six times. Six
// emails for one form reads as a fault and trains people to ignore the alert -
// which is worse than no alert. One per form per client per QUIET_HOURS, so a
// sitting produces one email and coming back tomorrow produces another.
//
// The stamp lives in the existing app_settings key/value table, so this needs
// no migration.
import { sql } from "@/lib/db"
import { sendFormSubmittedEmail } from "@/lib/resend"

const KEY_PREFIX = "form_notified:"

/** Long enough to cover one sitting, short enough that a return visit tells you. */
const QUIET_HOURS = 6

/** Everyone on the Staff access list. They all work the files. */
async function firmRecipients(): Promise<string[]> {
  try {
    const r = await sql`SELECT email FROM admin_users`
    return r.rows.map((row) => String(row.email)).filter(Boolean)
  } catch {
    return []
  }
}

/**
 * True when we have not emailed about this form for this client recently.
 * Records the attempt at the same time, so two saves landing together cannot
 * both decide they are first.
 */
async function shouldNotify(clientId: string, formKey: string): Promise<boolean> {
  const key = `${KEY_PREFIX}${clientId}:${formKey}`
  const cutoff = new Date(Date.now() - QUIET_HOURS * 60 * 60 * 1000).toISOString()
  try {
    const r = await sql`
      INSERT INTO app_settings (key, value, updated_at)
      VALUES (${key}, ${new Date().toISOString()}, now())
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()
      WHERE app_settings.value < ${cutoff}
      RETURNING key
    `
    return r.rows.length > 0
  } catch {
    // Fail QUIET. If the stamp cannot be read we do not know whether an email
    // has already gone, and sending a duplicate every few seconds is worse than
    // missing one.
    return false
  }
}

/**
 * Email the firm that a client has filled a form in. Never throws, never
 * blocks: the client's answers are already saved and a mail problem must not
 * turn a successful save into an error on their screen.
 */
export async function notifyFormSaved(opts: {
  clientId: string
  clientName: string
  formKey: string
  formLabel: string
  answered: number
}): Promise<void> {
  try {
    // Nothing filled in yet is not worth an email.
    if (opts.answered === 0) return
    if (!(await shouldNotify(opts.clientId, opts.formKey))) return
    const to = await firmRecipients()
    await sendFormSubmittedEmail({
      to,
      clientName: opts.clientName,
      formLabel: opts.formLabel,
      answered: opts.answered,
    })
  } catch (e) {
    console.error("[form-notify] failed:", e instanceof Error ? e.message : e)
  }
}
