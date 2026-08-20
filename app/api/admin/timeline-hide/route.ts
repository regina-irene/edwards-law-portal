// app/api/admin/timeline-hide/route.ts - take an activity entry off the Field
// Notes log, or put it back (2026-08-20).
//
// POST   { eventId }  hide it
// DELETE ?id=…        show it again
//
// Nothing here touches the message, file, form or task the entry describes. See
// lib/hidden-events for why that separation matters.
import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin"
import { hideEvent, unhideEvent, isEventId } from "@/lib/hidden-events"

export const dynamic = "force-dynamic"

export async function POST(req: Request) {
  const check = await requireAdmin()
  if (check.status !== "ok") return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = (await req.json().catch(() => null)) as { eventId?: unknown } | null
  const eventId = body?.eventId
  if (!isEventId(eventId)) {
    return NextResponse.json({ error: "A valid activity entry is required." }, { status: 400 })
  }

  const ok = await hideEvent(eventId, check.name || check.email)
  if (!ok) {
    return NextResponse.json(
      { error: "Couldn't hide that entry - it's still on the log." },
      { status: 500 }
    )
  }
  return NextResponse.json({ ok: true, eventId })
}

export async function DELETE(req: Request) {
  const check = await requireAdmin()
  if (check.status !== "ok") return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const eventId = new URL(req.url).searchParams.get("id")
  if (!isEventId(eventId)) {
    return NextResponse.json({ error: "A valid activity entry is required." }, { status: 400 })
  }

  const ok = await unhideEvent(eventId)
  if (!ok) {
    return NextResponse.json({ error: "Couldn't restore that entry." }, { status: 500 })
  }
  return NextResponse.json({ ok: true, eventId })
}
