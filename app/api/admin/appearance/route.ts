// Admin: read / save the firm-wide admin color scheme + gradient (2026-08-18).
import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin"
import { getAdminPrefs, saveAdminPrefs } from "@/lib/admin-prefs"
import { SCHEMES, DEFAULT_SCHEME_KEY } from "@/lib/color-schemes"

export async function GET() {
  const check = await requireAdmin()
  if (check.status !== "ok") return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  return NextResponse.json(await getAdminPrefs())
}

export async function PUT(req: Request) {
  const check = await requireAdmin()
  if (check.status !== "ok") return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json().catch(() => null)
  const scheme = typeof body?.scheme === "string" ? body.scheme : DEFAULT_SCHEME_KEY
  if (!SCHEMES[scheme]) return NextResponse.json({ error: "Unknown color scheme" }, { status: 400 })
  const gradient = Boolean(body?.gradient)

  try {
    await saveAdminPrefs({ scheme, gradient })
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error("[admin/appearance] save failed:", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
