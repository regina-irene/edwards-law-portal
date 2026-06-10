import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin"
import { getWatch, setWatch, getAdminPhone, setAdminPhone } from "@/lib/sms-watch"
import { toE164 } from "@/lib/twilio"

export async function GET(req: Request) {
  const check = await requireAdmin()
  if (check.status !== "ok") return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const clientId = searchParams.get("clientId") ?? ""
  const [enabled, adminPhone] = await Promise.all([
    clientId ? getWatch(clientId) : Promise.resolve(false),
    getAdminPhone(),
  ])
  return NextResponse.json({ enabled, hasPhone: Boolean(adminPhone), adminPhone })
}

export async function PUT(req: Request) {
  const check = await requireAdmin()
  if (check.status !== "ok") return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json().catch(() => null)

  if (typeof body?.adminPhone === "string") {
    const e164 = toE164(body.adminPhone)
    if (!e164) return NextResponse.json({ error: "That phone number doesn't look valid" }, { status: 400 })
    await setAdminPhone(e164)
  }

  if (typeof body?.clientId === "string" && body.clientId && typeof body?.enabled === "boolean") {
    await setWatch(body.clientId, body.enabled)
  }

  return NextResponse.json({ ok: true })
}
