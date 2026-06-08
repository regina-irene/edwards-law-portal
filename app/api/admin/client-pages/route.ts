// Admin: per-client page visibility (which pages a client can see).
import { requireAdmin } from "@/lib/admin"
import { sql } from "@/lib/db"
import { getAllPages, getEffectiveHiddenKeys } from "@/lib/portal-pages"
import { NextResponse } from "next/server"

export async function GET(req: Request) {
  const check = await requireAdmin()
  if (check.status !== "ok") return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const clientId = new URL(req.url).searchParams.get("clientId")
  if (!clientId) return NextResponse.json({ error: "clientId required" }, { status: 400 })

  const [pages, hiddenSet] = await Promise.all([getAllPages(), getEffectiveHiddenKeys(clientId)])
  return NextResponse.json({ pages, hidden: [...hiddenSet] })
}

export async function PUT(req: Request) {
  const check = await requireAdmin()
  if (check.status !== "ok") return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const body = (await req.json().catch(() => null)) as { clientId?: string; pageKey?: string; hidden?: boolean } | null
  if (!body?.clientId || !body?.pageKey || typeof body.hidden !== "boolean") {
    return NextResponse.json({ error: "clientId, pageKey, hidden required" }, { status: 400 })
  }
  try {
    await sql`
      INSERT INTO client_page_prefs (client_id, page_key, hidden)
      VALUES (${body.clientId}, ${body.pageKey}, ${body.hidden})
      ON CONFLICT (client_id, page_key) DO UPDATE SET hidden = EXCLUDED.hidden
    `
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
