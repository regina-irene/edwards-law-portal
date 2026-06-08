// Admin: rename a page's nav label (custom pages update their title;
// built-in pages get a label override).
import { requireAdmin } from "@/lib/admin"
import { sql } from "@/lib/db"
import { NextResponse } from "next/server"

export async function POST(req: Request) {
  const check = await requireAdmin()
  if (check.status !== "ok") return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = (await req.json().catch(() => null)) as { pageKey?: string; label?: string } | null
  const pageKey = typeof body?.pageKey === "string" ? body.pageKey : ""
  const label = typeof body?.label === "string" ? body.label.trim() : ""
  if (!pageKey || !label) return NextResponse.json({ error: "pageKey and label required" }, { status: 400 })

  try {
    const custom = await sql`SELECT 1 FROM custom_pages WHERE slug = ${pageKey}`
    if (custom.rows.length > 0) {
      await sql`UPDATE custom_pages SET title = ${label} WHERE slug = ${pageKey}`
    } else {
      await sql`
        INSERT INTO page_labels (page_key, label) VALUES (${pageKey}, ${label})
        ON CONFLICT (page_key) DO UPDATE SET label = EXCLUDED.label
      `
    }
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
