import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin"
import { saveFirmAnnouncement } from "@/lib/firm-announcement"

export async function PUT(req: Request) {
  const check = await requireAdmin()
  if (check.status !== "ok") return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json().catch(() => null)
  const html = typeof body?.html === "string" ? body.html : ""
  await saveFirmAnnouncement(html)
  return NextResponse.json({ ok: true })
}
