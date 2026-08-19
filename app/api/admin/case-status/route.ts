// app/api/admin/case-status/route.ts - the admin Status board: read every
// client's case stage + client-facing status text, and save changes back to
// the Airtable Status table. Admin-only; this writes to Regina's live base.
import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin"
import { buildStatusBoard, updateCaseStatus, CASE_STAGE_CHOICES } from "@/lib/case-status"
import { getCaseStatus } from "@/lib/airtable"
import { appendStatusHistory, statusChangeNoteHtml } from "@/lib/status-history"
import { createNote } from "@/lib/notes"
import { saveRichStatus, statusHtmlToPlain, getRichStatus, hashOf } from "@/lib/status-rich"
import { plainToHtml } from "@/lib/message-format"
import { sanitizeNotesHtml } from "@/lib/sanitize"

export const dynamic = "force-dynamic"

export async function GET() {
  const check = await requireAdmin()
  if (check.status !== "ok") return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    // Joins the client roster to the Status board on clientId === record id, and
    // keeps clients with no Status row so nobody silently disappears.
    const rows = await buildStatusBoard()
    return NextResponse.json({ rows })
  } catch (e) {
    console.error("[case-status] load failed:", e)
    return NextResponse.json({ error: "Couldn't load the case board right now." }, { status: 500 })
  }
}

interface PatchBody {
  recordId?: unknown
  stages?: unknown
  statusText?: unknown
  statusHtml?: unknown
}

export async function PATCH(req: Request) {
  const check = await requireAdmin()
  if (check.status !== "ok") return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = (await req.json().catch(() => null)) as PatchBody | null
  const recordId = typeof body?.recordId === "string" ? body.recordId.trim() : ""
  if (!recordId.startsWith("rec")) {
    return NextResponse.json({ error: "A valid case record id is required." }, { status: 400 })
  }

  const patch: { stages?: string[]; statusText?: string } = {}
  const rawStages: unknown = body ? body.stages : undefined
  const rawStatusText: unknown = body ? body.statusText : undefined

  if (rawStages !== undefined) {
    if (!Array.isArray(rawStages)) {
      return NextResponse.json({ error: "Stages must be a list." }, { status: 400 })
    }
    const stages = rawStages
      .map((s: unknown) => (typeof s === "string" ? s.trim() : ""))
      .filter((s: string) => s.length > 0)
    // Validate against the board's real option list. Airtable would happily
    // create a brand-new select option from a typo, so reject rather than write
    // junk into the live base.
    const unknownStages = stages.filter((s) => !CASE_STAGE_CHOICES.includes(s))
    if (unknownStages.length > 0) {
      return NextResponse.json(
        { error: `Unknown case stage: ${unknownStages.join(", ")}` },
        { status: 400 }
      )
    }
    // De-duplicate; a multi-select can't hold the same option twice.
    patch.stages = Array.from(new Set(stages))
  }

  // The board sends formatted HTML; Airtable stores the plain text of it, and
  // the formatting is kept portal-side. `statusText` is still accepted so any
  // other caller keeps working. (2026-08-18)
  const rawStatusHtml: unknown = body ? body.statusHtml : undefined
  let statusHtml: string | null = null

  if (rawStatusHtml !== undefined) {
    if (typeof rawStatusHtml !== "string") {
      return NextResponse.json({ error: "Status must be text." }, { status: 400 })
    }
    statusHtml = sanitizeNotesHtml(rawStatusHtml)
    patch.statusText = statusHtmlToPlain(statusHtml)
  } else if (rawStatusText !== undefined) {
    if (typeof rawStatusText !== "string") {
      return NextResponse.json({ error: "Status text must be text." }, { status: 400 })
    }
    patch.statusText = rawStatusText.trim()
  }

  if (patch.stages === undefined && patch.statusText === undefined) {
    return NextResponse.json({ error: "Nothing to save." }, { status: 400 })
  }

  try {
    // Read the current values BEFORE writing, so the record of the change can
    // say what it changed from - including the formatting it was written with.
    // Fails soft: an unreadable "before" costs the note its comparison, never
    // the save itself.
    const [before, beforeRich] = await Promise.all([
      getCaseStatus(recordId).catch(() => null),
      getRichStatus(recordId).catch(() => null),
    ])

    await updateCaseStatus(recordId, patch)

    // Retention (2026-08-18). Two writes, both non-blocking: the client's own
    // status history, and the same change as a field note on the admin case
    // log. If either fails the status is still saved - they record the change,
    // they aren't the change.
    const fromStages = before?.stages ?? []
    const fromText = before?.statusText ?? ""
    const toStages = patch.stages ?? fromStages
    const toText = patch.statusText ?? fromText
    const changed =
      toText !== fromText ||
      toStages.length !== fromStages.length ||
      toStages.some((s, i) => s !== fromStages[i])

    if (changed) {
      // Formatting is stored against the plain text Airtable now holds, so an
      // edit made directly on the board invalidates it rather than leaving old
      // styling over new words.
      if (statusHtml !== null) {
        await saveRichStatus(recordId, statusHtml, toText)
      }
      // The portal's clientId IS the Status record id, so the same value keys
      // the history and the field note.
      await appendStatusHistory(recordId, {
        statusText: toText,
        statusHtml: statusHtml ?? undefined,
        stages: toStages,
        by: check.name || check.email,
      })
      // Use the stored formatting for the "before" quote only while it still
      // matches the words it was saved against; otherwise quote plain text.
      const fromHtml =
        beforeRich && beforeRich.hash === hashOf(fromText)
          ? beforeRich.html
          : plainToHtml(fromText)
      const toHtml = statusHtml ?? plainToHtml(toText)

      await createNote(
        recordId,
        statusChangeNoteHtml({ fromStages, toStages, fromHtml, toHtml, fromText, toText }),
        { email: check.email, name: check.name }
      ).catch((e) => {
        console.error("[case-status] field note failed:", e)
      })
    }

    return NextResponse.json({ ok: true, recordId, ...patch })
  } catch (e) {
    console.error("[case-status] save failed:", e)
    return NextResponse.json(
      { error: "Airtable wouldn't accept that save - nothing was changed." },
      { status: 502 }
    )
  }
}
