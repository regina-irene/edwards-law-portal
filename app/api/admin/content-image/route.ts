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
    // addRandomSuffix, or a second upload of a file with the same name FAILS.
    // @vercel/blob throws on a repeat pathname unless told otherwise, so
    // uploading "logo.png" once worked and every attempt after that 500'd
    // (Regina, 2026-09-04). A suffix is the right fix rather than
    // allowOverwrite: two different images that happen to share a filename
    // should both survive, not silently replace one another.
    const blob = await put(`content/${safe}`, file, {
      ...blobAuth(),
      access: "private",
      addRandomSuffix: true,
    })
    const ins = await sql`
      INSERT INTO content_images (pathname, url, uploaded_by)
      VALUES (${blob.pathname}, ${blob.url}, ${check.email})
      RETURNING id
    `
    return NextResponse.json({ url: `/api/content-image/${ins.rows[0].id}` })
  } catch (e) {
    // The real reason, not a generic one. "Upload failed" reaching a UI that
    // then said "images only, up to 10 MB" sent Regina looking at her image
    // for an hour when the problem was a duplicate filename.
    const msg = e instanceof Error ? e.message : "Upload failed"
    console.error("[content-image] upload failed:", msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
