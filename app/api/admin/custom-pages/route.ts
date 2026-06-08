// Admin: create / list / delete custom portal pages.
import { requireAdmin } from "@/lib/admin"
import { sql } from "@/lib/db"
import { getCustomPages, slugify, BUILTIN_PAGE_KEYS } from "@/lib/portal-pages"
import { NextResponse } from "next/server"

export async function GET() {
  const check = await requireAdmin()
  if (check.status !== "ok") return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  return NextResponse.json({ pages: await getCustomPages() })
}

export async function POST(req: Request) {
  const check = await requireAdmin()
  if (check.status !== "ok") return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = (await req.json().catch(() => null)) as { title?: string } | null
  const title = typeof body?.title === "string" ? body.title.trim() : ""
  if (!title) return NextResponse.json({ error: "title required" }, { status: 400 })

  let base = slugify(title) || "page"
  if (BUILTIN_PAGE_KEYS.includes(base)) base = `${base}-page`

  try {
    // Ensure unique slug
    let slug = base
    let n = 2
    while ((await sql`SELECT 1 FROM custom_pages WHERE slug = ${slug}`).rows.length > 0) {
      slug = `${base}-${n++}`
    }
    const posRes = await sql`SELECT COALESCE(MAX(position) + 1, 0) AS pos FROM custom_pages`
    const position = posRes.rows[0]?.pos ?? 0
    const ins = await sql`
      INSERT INTO custom_pages (slug, title, position) VALUES (${slug}, ${title}, ${position})
      RETURNING slug, title, position
    `
    // Append to nav order so it shows up
    const navRes = await sql`SELECT id, pages FROM nav_order LIMIT 1`
    if (navRes.rows.length > 0) {
      const pages: string[] = navRes.rows[0].pages ?? []
      if (!pages.includes(slug)) {
        await sql`UPDATE nav_order SET pages = ${JSON.stringify([...pages, slug])}::jsonb WHERE id = ${navRes.rows[0].id}`
      }
    }
    return NextResponse.json({ page: ins.rows[0] }, { status: 201 })
  } catch (e) {
    console.error("[custom-pages] create failed:", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  const check = await requireAdmin()
  if (check.status !== "ok") return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const body = (await req.json().catch(() => null)) as { slug?: string } | null
  if (!body?.slug) return NextResponse.json({ error: "slug required" }, { status: 400 })

  try {
    await sql`DELETE FROM custom_pages WHERE slug = ${body.slug}`
    await sql`DELETE FROM page_content WHERE page = ${body.slug}`
    await sql`DELETE FROM client_page_prefs WHERE page_key = ${body.slug}`
    const navRes = await sql`SELECT id, pages FROM nav_order LIMIT 1`
    if (navRes.rows.length > 0) {
      const pages: string[] = (navRes.rows[0].pages ?? []).filter((p: string) => p !== body.slug)
      await sql`UPDATE nav_order SET pages = ${JSON.stringify(pages)}::jsonb WHERE id = ${navRes.rows[0].id}`
    }
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
