// Upload a file attachment for a message (admin or the owning client).
import { requireAdmin } from "@/lib/admin"
import { getPortalClient } from "@/lib/portal-client"
import { assertClientCanWrite } from "@/lib/client-write-guard"
import { sql } from "@/lib/db"
import { deliverClientUpload } from "@/lib/client-uploads"
import { put } from "@vercel/blob"
import { NextResponse } from "next/server"

export const runtime = "nodejs"

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
  // Only the client's own attachments are copied to the firm's Drive folder.
  const admin = await requireAdmin()
  let isClientUpload = false
  if (admin.status !== "ok") {
    const client = await getPortalClient()
    if (!client?.clientId || String(client.clientId) !== messageClientId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
    // Client branch only - the firm can still attach files to an archived
    // client's conversation.
    const gate = await assertClientCanWrite()
    if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status })
    isClientUpload = true
  }

  try {
    const safe = file.name.replace(/[^\w.\-]+/g, "_") || "file"
    // Read the bytes once: the portal copy and the Drive copy share them.
    const buffer = Buffer.from(await file.arrayBuffer())
    const blob = await put(`messages/${messageId}/${safe}`, buffer, {
      access: "private",
      contentType: file.type || undefined,
    })
    const ins = await sql`
      INSERT INTO message_attachments (message_id, client_id, file_name, pathname, url, content_type, size)
      VALUES (${messageId}, ${messageClientId}, ${file.name}, ${blob.pathname}, ${blob.url}, ${file.type || null}, ${file.size})
      RETURNING id, file_name
    `
    // Deliver to the firm's Drive folder. Fail-soft - the portal copy is saved.
    if (isClientUpload) {
      await deliverClientUpload({ clientId: messageClientId, fileName: file.name, buffer, mimeType: file.type })
    }
    return NextResponse.json({ attachment: ins.rows[0] }, { status: 201 })
  } catch (e) {
    console.error("[message-files] upload failed:", e)
    return NextResponse.json({ error: "Upload failed" }, { status: 500 })
  }
}
