// lib/admin-archive.ts - the admin side of archiving (2026-08-19).
//
// lib/client-archive.ts owns the client's own experience: the 30-day read-only
// wind-down, and the stamp that starts it. Admin lists need something smaller
// and read-only - for each client, "are they archived" and one short line of
// human text ("closed 12 days ago", "access ended") to sit beside the chip.
//
// Everything here reads. Nothing here ever creates a stamp, so opening an admin
// page can never start somebody's clock.
import { archiveStateFromStamp, getArchiveStamps, ARCHIVE_GRACE_DAYS } from "@/lib/client-archive"

export interface ArchiveNote {
  archived: boolean
  /** ISO date the portal first saw this client archived, or null if unstamped. */
  archivedAt: string | null
  /** Whole days of read-only access left. */
  daysLeft: number
  /** True once the 30 days are up and the client can no longer sign in. */
  accessClosed: boolean
  /** One short line for a list row. Empty string for an active client. */
  note: string
}

export const ACTIVE_NOTE: ArchiveNote = {
  archived: false,
  archivedAt: null,
  daysLeft: ARCHIVE_GRACE_DAYS,
  accessClosed: false,
  note: "",
}

/**
 * The line that goes next to the "Archived" chip. Pure - safe to call anywhere
 * on the server once you already hold the stamp.
 *
 * No stamp yet means the box was ticked in Airtable and the client hasn't been
 * back since; say nothing rather than guess a date.
 */
export function archiveNoteText(
  archived: boolean,
  archivedAt: string | null,
  now: Date = new Date()
): string {
  if (!archived) return ""
  const state = archiveStateFromStamp(archived, archivedAt, now)
  if (state.accessClosed) return "access ended"
  if (!archivedAt) return ""
  const elapsed = ARCHIVE_GRACE_DAYS - state.daysLeft
  if (elapsed <= 0) return "closed today"
  if (elapsed === 1) return "closed yesterday"
  return `closed ${elapsed} days ago`
}

/**
 * Archive state for a list of clients, in one read of the stamps table.
 *
 * Keyed by `clientId` (the linked Status record id the rest of the portal uses
 * as a client's id), and it always has an entry for every client passed in, so
 * a lookup never comes back undefined.
 */
export async function archiveNotes(
  clients: readonly { clientId: string; archived: boolean }[],
  now: Date = new Date()
): Promise<Map<string, ArchiveNote>> {
  const out = new Map<string, ArchiveNote>()
  const archivedIds: string[] = []
  for (const c of clients) {
    const id = String(c.clientId)
    if (!id) continue
    if (c.archived) archivedIds.push(id)
    else out.set(id, ACTIVE_NOTE)
  }
  if (archivedIds.length === 0) return out

  const stamps = await getArchiveStamps(archivedIds)
  for (const id of archivedIds) {
    const archivedAt = stamps.get(id) ?? null
    const state = archiveStateFromStamp(true, archivedAt, now)
    out.set(id, {
      archived: true,
      archivedAt,
      daysLeft: state.daysLeft,
      accessClosed: state.accessClosed,
      note: archiveNoteText(true, archivedAt, now),
    })
  }
  return out
}

/** Lookup that can't come back undefined. */
export function noteFor(notes: Map<string, ArchiveNote>, clientId: string): ArchiveNote {
  return notes.get(String(clientId)) ?? ACTIVE_NOTE
}
