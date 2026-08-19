// app/api/admin/clients/archive/route.ts — tick / untick "Archived" on the
// Clients board from inside the portal (2026-08-19).
//
// Two writes, in this order:
//   1. Airtable, because that checkbox is the source of truth for whether a
//      client is archived at all.
//   2. the local stamp, which is the source of truth for WHEN, and therefore
//      for the 30-day countdown.
//
// Stamping here rather than waiting for the client's next visit matters: a
// former client who never signs in again would otherwise keep an un-started
// clock forever, and the admin list would have no date to show.
//
// Nothing fails silently. If Airtable refuses the write, this says so with the
// real reason rather than returning ok and leaving Regina believing a client
// was archived when they weren't.
import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin"
import { setClientArchived } from "@/lib/airtable"
import { stampArchived, clearArchiveStamp } from "@/lib/client-archive"

export const dynamic = "force-dynamic"

interface ArchiveBody {
  recordId?: unknown
  clientId?: unknown
  archived?: unknown
}

export async function POST(req: Request) {
  const check = await requireAdmin()
  if (check.status !== "ok") return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = (await req.json().catch(() => null)) as ArchiveBody | null

  // The record to PATCH is the CLIENTS-table record id, not the linked Status
  // record id the rest of the portal calls "clientId". Writing to the wrong one
  // would tick a checkbox on the wrong table entirely.
  const recordId = typeof body?.recordId === "string" ? body.recordId.trim() : ""
  if (!recordId.startsWith("rec")) {
    return NextResponse.json({ error: "A valid client record id is required." }, { status: 400 })
  }

  if (typeof body?.archived !== "boolean") {
    return NextResponse.json({ error: "archived must be true or false." }, { status: 400 })
  }
  const archived = body.archived

  // Optional: without it the checkbox still flips, the countdown just starts on
  // the client's next visit instead of now.
  const clientId = typeof body?.clientId === "string" ? body.clientId.trim() : ""

  try {
    await setClientArchived(recordId, archived)
  } catch (e) {
    console.error("[clients/archive] Airtable write failed:", e)
    return NextResponse.json(
      { error: "Airtable wouldn't accept that change — nothing was saved." },
      { status: 502 }
    )
  }

  // The checkbox is already saved by this point, so a stamp problem must not
  // read as a failed archive. Both helpers already fail soft.
  let archivedAt: string | null = null
  if (clientId) {
    if (archived) archivedAt = await stampArchived(clientId)
    else await clearArchiveStamp(clientId)
  }

  return NextResponse.json({ ok: true, recordId, archived, archivedAt })
}
