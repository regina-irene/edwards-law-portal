// lib/client-write-guard.ts — the server half of the archived-client wind-down.
//
// lib/client-archive.ts decides WHETHER a client may still write; this decides
// what a write ROUTE does about it. Hiding the buttons in the browser is a
// courtesy, not a control — anyone can still POST — so every client-facing
// write endpoint calls assertClientCanWrite() before it touches the database.
//
// Admin routes deliberately do NOT use this. Regina has to keep working on a
// closed client's file long after the client stops being able to write to it.
import { cache } from "react"
import type { AirtableClient } from "@/lib/airtable"
import { getPortalClient } from "@/lib/portal-client"
import { ACTIVE_STATE, resolveArchiveState, type ArchiveState } from "@/lib/client-archive"

/** Shown when a closed client tries to write during the 30-day read-only window. */
export const READ_ONLY_MESSAGE =
  "Your case with our office is closed, so the portal is read-only. Please contact the office if you need something."

/** Shown once the read-only window has run out entirely. */
export const ACCESS_CLOSED_MESSAGE =
  "Your portal access has ended. Please contact the office and we'll be glad to help."

export type ClientWriteCheck =
  | { ok: true; client: AirtableClient }
  | { ok: false; status: number; error: string }

// Wrapped in React's per-request `cache` like the rest of lib/portal-client.ts.
// The layout and the page both ask for this on a single render, and
// resolveArchiveState writes (a stamp, or a DELETE clearing one) — so without
// this the same request would hit the database two or three times over.
//
// FAIL SAFE, NOT OPEN: if resolveArchiveState throws — Postgres unreachable, a
// bad stamp row, anything — we return ACTIVE_STATE and let the client carry on.
// Shutting a paying client out of their own case file because the database
// hiccuped is far worse than one extra day of write access for someone whose
// case has closed.
const archiveStateFor = cache(async (clientId: string, archived: boolean): Promise<ArchiveState> => {
  try {
    return await resolveArchiveState(clientId, archived)
  } catch (e) {
    console.error("[client-write-guard] archive state failed, treating client as active:", e)
    return ACTIVE_STATE
  }
})

/** The archive state for one client, resolved so a failure can never lock anyone out. */
export async function getPortalArchiveState(client: AirtableClient | null): Promise<ArchiveState> {
  if (!client?.clientId) return ACTIVE_STATE
  return archiveStateFor(String(client.clientId), client.archived)
}

/**
 * Gate for every client-facing write route.
 *
 * Returns the resolved client on success so the caller doesn't need its own
 * getPortalClient() call (it is React-cached per request either way).
 */
export async function assertClientCanWrite(): Promise<ClientWriteCheck> {
  const client = await getPortalClient().catch(() => null)
  if (!client?.clientId) {
    return { ok: false, status: 403, error: "We couldn't find your client account. Please contact the office." }
  }

  const state = await getPortalArchiveState(client)
  if (state.accessClosed) return { ok: false, status: 403, error: ACCESS_CLOSED_MESSAGE }
  if (state.readOnly) return { ok: false, status: 403, error: READ_ONLY_MESSAGE }

  return { ok: true, client }
}
