import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin"
import { sendInviteEmail } from "@/lib/resend"

export async function POST(req: Request) {
  const check = await requireAdmin()
  if (check.status !== "ok") return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json().catch(() => null)
  const to = String(body?.email ?? "").trim()
  const firstName = String(body?.firstName ?? "").trim()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    return NextResponse.json({ error: "Client has no valid email" }, { status: 400 })
  }

  try {
    await sendInviteEmail({ to, firstName })
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error("[send-invite] failed:", e)
    return NextResponse.json({ error: "Send failed" }, { status: 500 })
  }
}
