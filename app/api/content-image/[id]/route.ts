// Streams an inline content image (private blob) to any logged-in admin or client.
import { requireAdmin } from "@/lib/admin"
import { getPortalClient } from "@/lib/portal-client"
import { sql } from "@/lib/db"
import { get } from "@vercel/blob"
import { blobAuth } from "@/lib/blob-token"
import { NextResponse } from "next/server"

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  // Allow admins (editing) and logged-in clients (viewing).
  const admin = await requireAdmin()
  if (admin.status !== "ok") {
    const client = await getPortalClient()
    if (!client?.clientId) return new NextResponse("Forbidden", { status: 403 })
  }

  const { id } = await params
  const r = await sql`SELECT pathname FROM content_images WHERE id = ${id}`
  if (r.rows.length === 0) return new NextResponse("Not found", { status: 404 })

  const result = await get(r.rows[0].pathname, { ...blobAuth(), access: "private" })
  if (!result || result.statusCode !== 200) return new NextResponse("Not found", { status: 404 })

  return new NextResponse(result.stream, {
    headers: {
      "Content-Type": result.blob.contentType || "image/*",
      "Cache-Control": "private, no-cache",
    },
  })
}
