// Upload a file attachment for a message (admin or the owning client).
import { requireAdmin } from "@/lib/admin"
import { getPortalClient } from "@/lib/portal-client"
import { sql } from "@/lib/db"
import { put } from "@vercel/blob"
import { NextResponse } from "next/server"

const MAX = 25 * 1024 * 1024

export async function POST(req: Request) {
  const form = await req.formData().catch(() => null)
  const file = form?.get("file")
  const messageId = form?.get("messageId")
  if (!(file instanceof File) || typeof messageId !== "string" || !messageId) {
    return NextResponse.json({ error: "file and messageId required" }, { status: 400 })
  }
  if (file.size > MAX) return NextResponse.json({ error: "File too large (max 25MB)" }, { status: 413 })

  // The message determines which conversation (client) this belongs to.
  const msg = await sql`SELECT client_id FROM chat_messages WHERE id = ${messageId}`
  if (msg.rows.length === 0) return NextResponse.json({ error: "Message not found" }, { status: 404 })
  const messageClientId = msg.rows[0].client_id as string

  // Authorize: admin (any) or the client who owns this conversation.
  const admin = await requireAdmin()
  if (admin.status !== "ok") {
    const client = await getPortalClient()
    if (!client?.clientId || String(client.clientId) !== messageClientId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
  }

  try {
    const safe = file.name.replace(/[^\w.\-]+/g, "_") || "file"
    const blob = await put(`messages/${messageId}/${safe}`, file, { access: "private" })
    const ins = await sql`
      INSERT INTO message_attachments (message_id, client_id, file_name, pathname, url, content_type, size)
      VALUES (${messageId}, ${messageClientId}, ${file.name}, ${blob.pathname}, ${blob.url}, ${file.type || null}, ${file.size})
      RETURNING id, file_name
    `
    return NextResponse.json({ attachment: ins.rows[0] }, { status: 201 })
  } catch (e) {
    console.error("[message-files] upload failed:", e)
    return NextResponse.json({ error: "Upload failed" }, { status: 500 })
  }
}
