// lib/client-archive.ts — the 30-day wind-down for archived clients (2026-08-18).
//
// Airtable's "Archived" checkbox says WHETHER a client is archived; it can't say
// WHEN, and Regina archives straight from the board as often as from the portal.
// So the portal stamps the date the first time it sees the box ticked, and that
// stamp drives the countdown:
//
//   day 0-30   read-only. They can still sign in and read their whole case file,
//              with a banner counting down. Nothing can be sent or uploaded.
//   day 31+    access closed. A plain page pointing them at the office.
//
// Unticking "Archived" clears the stamp, so un-archiving fully restores them.
//
// The stamps live in the existing app_settings key/value table rather than a new
// one, so this needs no migration to start working.
import { sql } from "@/lib/db"

export const ARCHIVE_GRACE_DAYS = 30
const KEY_PREFIX = "archived_at:"

export interface ArchiveState {
  archived: boolean
  /** ISO date the portal first saw this client archived, or null. */
  archivedAt: string | null
  /** Whole days left of read-only access. 0 once the window has closed. */
  daysLeft: number
  /** True while they can still read, but not write. */
  readOnly: boolean
  /** True once the grace period is over and they should be shut out. */
  accessClosed: boolean
}

export const ACTIVE_STATE: ArchiveState = {
  archived: false,
  archivedAt: null,
  daysLeft: ARCHIVE_GRACE_DAYS,
  readOnly: false,
  accessClosed: false,
}

function daysBetween(fromIso: string, now: Date): number {
  const then = new Date(fromIso).getTime()
  if (Number.isNaN(then)) return 0
  return Math.floor((now.getTime() - then) / 86_400_000)
}

function stateFrom(archivedAt: string | null, now: Date): ArchiveState {
  if (!archivedAt) {
    // Archived but not yet stamped — treat as day 0 rather than locking them
    // out on a missing row. The stamp is written on the same request.
    return { archived: true, archivedAt: null, daysLeft: ARCHIVE_GRACE_DAYS, readOnly: true, accessClosed: false }
  }
  const elapsed = daysBetween(archivedAt, now)
  const daysLeft = Math.max(0, ARCHIVE_GRACE_DAYS - elapsed)
  const accessClosed = elapsed >= ARCHIVE_GRACE_DAYS
  return { archived: true, archivedAt, daysLeft, readOnly: !accessClosed, accessClosed }
}

/** Read the stamp for one client. */
export async function getArchivedAt(clientId: string): Promise<string | null> {
  try {
    const r = await sql`SELECT value FROM app_settings WHERE key = ${KEY_PREFIX + String(clientId)} LIMIT 1`
    return r.rows[0]?.value ?? null
  } catch {
    return null
  }
}

/**
 * Start the clock. Idempotent: the first stamp wins, so re-reading an already
 * archived client never extends their window.
 */
export async function stampArchived(clientId: string, when: Date = new Date()): Promise<string> {
  const iso = when.toISOString()
  try {
    const r = await sql`
      INSERT INTO app_settings (key, value, updated_at)
      VALUES (${KEY_PREFIX + String(clientId)}, ${iso}, now())
      ON CONFLICT (key) DO NOTHING
      RETURNING value
    `
    if (r.rows.length > 0) return String(r.rows[0].value)
    return (await getArchivedAt(clientId)) ?? iso
  } catch {
    return iso
  }
}

/** Un-archiving clears the stamp, so a restored client starts clean. */
export async function clearArchiveStamp(clientId: string): Promise<void> {
  try {
    await sql`DELETE FROM app_settings WHERE key = ${KEY_PREFIX + String(clientId)}`
  } catch {
    // fail soft — a stale stamp is harmless while Archived is unticked
  }
}

/**
 * The state for one client, stamping on first sight. Call this on the client's
 * own portal requests — it is the single source of truth for whether they may
 * read, write, or neither.
 */
export async function resolveArchiveState(
  clientId: string,
  archived: boolean,
  now: Date = new Date()
): Promise<ArchiveState> {
  if (!archived) {
    await clearArchiveStamp(clientId)
    return ACTIVE_STATE
  }
  const existing = await getArchivedAt(clientId)
  const archivedAt = existing ?? (await stampArchived(clientId, now))
  return stateFrom(archivedAt, now)
}

/**
 * Stamps for many clients at once, for admin views. Read-only: it does NOT
 * create stamps, so simply opening an admin page can't start anyone's clock.
 */
export async function getArchiveStamps(clientIds: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>()
  if (clientIds.length === 0) return out
  try {
    const keys = clientIds.map((id) => KEY_PREFIX + String(id))
    const r = await sql.query("SELECT key, value FROM app_settings WHERE key = ANY($1)", [keys])
    for (const row of r.rows) out.set(String(row.key).slice(KEY_PREFIX.length), String(row.value))
  } catch {
    // fail soft — the admin list just shows no archive dates
  }
  return out
}

/** Days-left for an admin list, without touching the database again. */
export function archiveStateFromStamp(
  archived: boolean,
  archivedAt: string | null,
  now: Date = new Date()
): ArchiveState {
  return archived ? stateFrom(archivedAt, now) : ACTIVE_STATE
}
