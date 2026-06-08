// Stream a message attachment to the admin or the owning client.
import { requireAdmin } from "@/lib/admin"
import { getPortalClient } from "@/lib/portal-client"
import { sql } from "@/lib/db"
import { get } from "@vercel/blob"
import { NextResponse } from "next/server"

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const r = await sql`SELECT client_id, pathname, file_name, content_type FROM message_attachments WHERE id = ${id}`
  if (r.rows.length === 0) return new NextResponse("Not found", { status: 404 })
  const att = r.rows[0]

  const admin = await requireAdmin()
  if (admin.status !== "ok") {
    const client = await getPortalClient()
    if (!client?.clientId || String(client.clientId) !== att.client_id) {
      return new NextResponse("Forbidden", { status: 403 })
    }
  }

  const result = await get(att.pathname, { access: "private" })
  if (!result || result.statusCode !== 200) return new NextResponse("Not found", { status: 404 })
  return new NextResponse(result.stream, {
    headers: {
      "Content-Type": att.content_type || result.blob.contentType || "application/octet-stream",
      "Content-Disposition": `inline; filename="${String(att.file_name).replace(/"/g, "")}"`,
      "Cache-Control": "private, no-cache",
    },
  })
}
