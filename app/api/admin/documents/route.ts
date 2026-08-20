// app/api/admin/documents/route.ts - save the hand-filled columns on a
// Pleadings or Correspondence row in a client's own Airtable base (2026-08-20).
//
// Only "Notes" and the person column ("Filed by:" / "Sent by:") can be written.
// Everything else on those rows belongs to the Google Drive sync, and the next
// sync would undo it. See lib/doc-board.
import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin"
import { updateDocFields, type DocKind } from "@/lib/doc-board"

export const dynamic = "force-dynamic"

const KINDS: DocKind[] = ["pleadings", "correspondence"]

function isKind(v: unknown): v is DocKind {
  return typeof v === "string" && (KINDS as string[]).includes(v)
}

interface Body {
  baseId?: unknown
  kind?: unknown
  recordId?: unknown
  person?: unknown
  notes?: unknown
  personField?: unknown
  notesField?: unknown
}

export async function PATCH(req: Request) {
  const check = await requireAdmin()
  if (check.status !== "ok") return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = (await req.json().catch(() => null)) as Body | null

  const baseId = typeof body?.baseId === "string" ? body.baseId.trim() : ""
  const recordId = typeof body?.recordId === "string" ? body.recordId.trim() : ""
  const kind = body?.kind

  // Both ids are pasted straight into an Airtable URL, so they are checked for
  // shape rather than trusted. Airtable ids are "app…" and "rec…".
  if (!/^app[A-Za-z0-9]{10,}$/.test(baseId)) {
    return NextResponse.json({ error: "A valid client base is required." }, { status: 400 })
  }
  if (!/^rec[A-Za-z0-9]{10,}$/.test(recordId)) {
    return NextResponse.json({ error: "A valid document record is required." }, { status: 400 })
  }
  if (!isKind(kind)) {
    return NextResponse.json({ error: "Unknown document type." }, { status: 400 })
  }

  // The column names came from the row when it was read, so a base that spells
  // it "Filed By" is written back the same way. Constrained to the known
  // spellings so a tampered request cannot create a new column in a live base.
  const ALLOWED_PERSON = ["Filed by:", "Filed by", "Filed By", "Sent by:", "Sent By", "Sent by"]
  const ALLOWED_NOTES = ["Notes", "Note"]
  const personField = typeof body?.personField === "string" ? body.personField : ""
  const notesField = typeof body?.notesField === "string" ? body.notesField : ""
  if (!ALLOWED_PERSON.includes(personField) || !ALLOWED_NOTES.includes(notesField)) {
    return NextResponse.json({ error: "Unrecognised column." }, { status: 400 })
  }

  const patch: { person?: string; notes?: string } = {}
  if (body?.person !== undefined) {
    if (typeof body.person !== "string") {
      return NextResponse.json({ error: "That field must be text." }, { status: 400 })
    }
    // NOT trimmed, deliberately. These are single select options and the value
    // has to match the option on the board exactly. At least one of them
    // ("Them ") carries a trailing space, so trimming here would turn a valid
    // choice into one Airtable rejects. The picker only offers values already
    // stored in that base, so what arrives is already exact.
    patch.person = body.person
  }
  if (body?.notes !== undefined) {
    if (typeof body.notes !== "string") {
      return NextResponse.json({ error: "Notes must be text." }, { status: 400 })
    }
    patch.notes = body.notes.trim()
  }
  if (patch.person === undefined && patch.notes === undefined) {
    return NextResponse.json({ error: "Nothing to save." }, { status: 400 })
  }

  try {
    await updateDocFields(baseId, kind, recordId, patch, { personField, notesField })
    return NextResponse.json({ ok: true, recordId, ...patch })
  } catch (e) {
    console.error("[documents] save failed:", e)
    return NextResponse.json(
      { error: "Airtable wouldn't accept that save - nothing was changed." },
      { status: 502 }
    )
  }
}
