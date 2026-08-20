// Admin: upload / remove a page banner image (private Vercel Blob).
import { requireAdmin } from "@/lib/admin"
import { sql } from "@/lib/db"
import { put, del } from "@vercel/blob"
import { blobAuth } from "@/lib/blob-token"
import { NextResponse } from "next/server"

const MAX_BYTES = 10 * 1024 * 1024 // 10MB

export async function POST(req: Request) {
  const check = await requireAdmin()
  if (check.status !== "ok") return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const form = await req.formData().catch(() => null)
  if (!form) return NextResponse.json({ error: "Invalid form" }, { status: 400 })
  const file = form.get("file")
  const clientId = form.get("clientId")
  const page = form.get("page")

  if (!(file instanceof File) || typeof clientId !== "string" || !clientId || typeof page !== "string" || !page) {
    return NextResponse.json({ error: "file, clientId, page required" }, { status: 400 })
  }
  if (!file.type.startsWith("image/")) return NextResponse.json({ error: "Image files only" }, { status: 400 })
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "Image too large (max 10MB)" }, { status: 413 })

  try {
    const safe = file.name.replace(/[^\w.\-]+/g, "_") || "image"
    const blob = await put(`pages/${clientId}/${page}/${safe}`, file, { ...blobAuth(), access: "private" })
    await sql`
      INSERT INTO page_content (client_id, page, image_pathname, image_url, image_name)
      VALUES (${clientId}, ${page}, ${blob.pathname}, ${blob.url}, ${file.name})
      ON CONFLICT (client_id, page) DO UPDATE
        SET image_pathname = EXCLUDED.image_pathname,
            image_url = EXCLUDED.image_url,
            image_name = EXCLUDED.image_name
    `
    return NextResponse.json({ ok: true, image_name: file.name })
  } catch (e) {
    console.error("[page-image] upload failed:", e)
    return NextResponse.json({ error: "Upload failed" }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  const check = await requireAdmin()
  if (check.status !== "ok") return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const body = (await req.json().catch(() => null)) as { clientId?: string; page?: string } | null
  if (!body?.clientId || !body?.page) return NextResponse.json({ error: "clientId and page required" }, { status: 400 })

  try {
    const r = await sql`SELECT image_url FROM page_content WHERE client_id = ${body.clientId} AND page = ${body.page}`
    const url = r.rows[0]?.image_url
    if (url) { try { await del(url, { ...blobAuth() }) } catch (e) { console.error("[page-image] blob del:", e) } }
    await sql`
      UPDATE page_content SET image_pathname = NULL, image_url = NULL, image_name = NULL
      WHERE client_id = ${body.clientId} AND page = ${body.page}
    `
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
