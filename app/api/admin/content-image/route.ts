// Admin: upload an image to embed inline in rich-text content (private blob).
import { requireAdmin } from "@/lib/admin"
import { sql } from "@/lib/db"
import { put } from "@vercel/blob"
import { blobAuth } from "@/lib/blob-token"
import { NextResponse } from "next/server"

const MAX_BYTES = 10 * 1024 * 1024 // 10MB

export async function POST(req: Request) {
  const check = await requireAdmin()
  if (check.status !== "ok") return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const form = await req.formData().catch(() => null)
  const file = form?.get("file")
  if (!(file instanceof File)) return NextResponse.json({ error: "file required" }, { status: 400 })
  if (!file.type.startsWith("image/")) return NextResponse.json({ error: "Image files only" }, { status: 400 })
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "Image too large (max 10MB)" }, { status: 413 })

  try {
    const safe = file.name.replace(/[^\w.\-]+/g, "_") || "image"
    const blob = await put(`content/${safe}`, file, { ...blobAuth(), access: "private" })
    const ins = await sql`
      INSERT INTO content_images (pathname, url, uploaded_by)
      VALUES (${blob.pathname}, ${blob.url}, ${check.email})
      RETURNING id
    `
    return NextResponse.json({ url: `/api/content-image/${ins.rows[0].id}` })
  } catch (e) {
    console.error("[content-image] upload failed:", e)
    return NextResponse.json({ error: "Upload failed" }, { status: 500 })
  }
}
