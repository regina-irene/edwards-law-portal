// Stream a message attachment to the admin or the owning client.
import { requireAdmin } from "@/lib/admin"
import { getPortalClient } from "@/lib/portal-client"
import { sql } from "@/lib/db"
import { recordFileView } from "@/lib/file-views"
import { get } from "@vercel/blob"
import { blobAuth } from "@/lib/blob-token"
import { NextResponse } from "next/server"

// Attachments written before 2026-08-20 went into the private blob store from
// the server. Browser uploads land in the public store, so which one to read is
// decided by the URL that was recorded with the row, not by a fixed constant.
function blobAccess(url: unknown): "public" | "private" {
  return typeof url === "string" && /\.public\.blob\.vercel-storage\.com\//i.test(url) ? "public" : "private"
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const r = await sql`SELECT client_id, pathname, url, file_name, content_type FROM message_attachments WHERE id = ${id}`
  if (r.rows.length === 0) return new NextResponse("Not found", { status: 404 })
  const att = r.rows[0]

  const admin = await requireAdmin()
  let viewerRole: "client" | "firm" = "firm"
  let viewerEmail: string | null = null
  if (admin.status === "ok") {
    viewerEmail = admin.email
  } else {
    const client = await getPortalClient()
    if (!client?.clientId || String(client.clientId) !== att.client_id) {
      return new NextResponse("Forbidden", { status: 403 })
    }
    viewerRole = "client"
  }

  const result = await get(att.pathname, { ...blobAuth(), access: blobAccess(att.url) })
  if (!result || result.statusCode !== 200) return new NextResponse("Not found", { status: 404 })

  // Log the open only once the file is really being served.
  await recordFileView({
    scope: "message",
    fileId: id,
    clientId: att.client_id ? String(att.client_id) : null,
    viewerEmail,
    viewerRole,
  })
  return new NextResponse(result.stream, {
    headers: {
      "Content-Type": att.content_type || result.blob.contentType || "application/octet-stream",
      "Content-Disposition": `inline; filename="${String(att.file_name).replace(/"/g, "")}"`,
      "Cache-Control": "private, no-cache",
    },
  })
}
