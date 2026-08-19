// lib/status-history.ts - the record of every status update on a case
// (2026-08-18).
//
// Two audiences, deliberately two different stores:
//
//   • The CLIENT sees this history on their own Case Status page, so they can
//     look back at what they were told and when. That is what this file holds.
//   • REGINA gets the same change written into the case's Field Notes, which
//     are admin-only. Field notes must never be shown to a client - the private
//     case log lives there - so the two cannot share a store.
//
// Kept as one JSON row per client in the existing app_settings table rather
// than a new table, so this works the moment it deploys with no migration. A
// case accumulates a few dozen status changes at most, which is well within
// what a single row should hold.
import { sql } from "@/lib/db"

const KEY_PREFIX = "status_history:"
/** Plenty for the life of a case; keeps one row from growing without bound. */
const MAX_ENTRIES = 100

export interface StatusHistoryEntry {
  /** ISO timestamp of the change. */
  at: string
  /** The client-facing status text as it read after this change. */
  statusText: string
  /** The formatted version, when one was saved. Falls back to statusText. */
  statusHtml?: string
  /** Raw Airtable stage values as they read after this change. */
  stages: string[]
  /** Display name of whoever saved it. */
  by: string
}

function keyFor(clientId: string): string {
  return KEY_PREFIX + String(clientId)
}

/** Newest first. Fails soft to [] - history is a nice-to-have, never a blocker. */
export async function getStatusHistory(clientId: string): Promise<StatusHistoryEntry[]> {
  try {
    const r = await sql`SELECT value FROM app_settings WHERE key = ${keyFor(clientId)} LIMIT 1`
    const raw = r.rows[0]?.value
    if (!raw) return []
    const parsed: unknown = JSON.parse(String(raw))
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (e): e is StatusHistoryEntry =>
        Boolean(e) && typeof e === "object" && typeof (e as StatusHistoryEntry).at === "string"
    )
  } catch {
    return []
  }
}

/**
 * Record a change. Returns the entry that was stored, or null if nothing
 * actually changed (so re-saving an untouched row doesn't pad the history).
 */
export async function appendStatusHistory(
  clientId: string,
  entry: Omit<StatusHistoryEntry, "at">,
  now: Date = new Date()
): Promise<StatusHistoryEntry | null> {
  try {
    const existing = await getStatusHistory(clientId)
    const last = existing[0]
    const sameText = last?.statusText === entry.statusText
    const sameStages =
      last !== undefined &&
      last.stages.length === entry.stages.length &&
      last.stages.every((s, i) => s === entry.stages[i])
    if (last && sameText && sameStages) return null

    const next: StatusHistoryEntry = { at: now.toISOString(), ...entry }
    const trimmed = [next, ...existing].slice(0, MAX_ENTRIES)
    await sql`
      INSERT INTO app_settings (key, value, updated_at)
      VALUES (${keyFor(clientId)}, ${JSON.stringify(trimmed)}, now())
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()
    `
    return next
  } catch {
    // Never let a history write fail the status save itself - the status is
    // the thing that matters; the log is a record of it.
    return null
  }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}

/**
 * The field-note body for a status change. Written into the admin-only case
 * log so the change is retained alongside everything else on the file.
 *
 * The quoted blocks carry the client-facing text as HTML, so bold, colour and
 * highlighting survive into the note. Escaping the plain text here (the first
 * version of this) meant the log recorded the words but threw away every bit
 * of the emphasis they were written with. Callers pass already-sanitized HTML;
 * plain text should be run through plainToHtml first.
 */
export function statusChangeNoteHtml(args: {
  fromStages: string[]
  toStages: string[]
  fromHtml: string
  toHtml: string
  /** Plain text, used only to decide whether the wording actually changed. */
  fromText: string
  toText: string
}): string {
  const parts: string[] = ["<p><strong>Case status updated</strong></p>"]

  const stagesChanged =
    args.fromStages.length !== args.toStages.length ||
    args.fromStages.some((s, i) => s !== args.toStages[i])
  if (stagesChanged) {
    const before = args.fromStages.length ? args.fromStages.join(", ") : "none set"
    const after = args.toStages.length ? args.toStages.join(", ") : "none set"
    parts.push(`<p>Stage: ${escapeHtml(before)} → ${escapeHtml(after)}</p>`)
  }

  if (args.fromText !== args.toText) {
    if (args.fromText) {
      parts.push(`<p>Previous update to the client:</p><blockquote>${args.fromHtml}</blockquote>`)
    }
    parts.push(
      args.toText
        ? `<p>Now reads to the client:</p><blockquote>${args.toHtml}</blockquote>`
        : "<p>The client-facing update was cleared.</p>"
    )
  }

  return parts.join("")
}
