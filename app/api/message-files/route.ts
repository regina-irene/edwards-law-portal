// app/api/message-files/route.ts - record a message attachment the browser has
// already put in Vercel Blob (2026-08-20).
//
// This route used to take the file itself as multipart form data. Vercel refuses
// any serverless REQUEST BODY over ~4.5 MB before the handler runs, so a bigger
// attachment came back as a bare 413 while the composer promised 25 MB. The
// bytes now go from the browser straight to Blob and only the resulting URL is
// posted here, which is a few hundred bytes of JSON.
//
// The blob is deliberately NOT deleted at the end: message_attachments.url
// points at it and /api/message-files/[id] streams it back later.
import { requireAdmin } from "@/lib/admin"
import { getPortalClient } from "@/lib/portal-client"
import { assertClientCanWrite } from "@/lib/client-write-guard"
import { sql } from "@/lib/db"
import { deliverClientUpload } from "@/lib/client-uploads"
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_LABEL } from "@/lib/upload-limits"
import { moveToPrivateBlob, type PrivateBlob } from "@/lib/blob-private"
import { NextResponse } from "next/server"

export const runtime = "nodejs"
// A client's attachment is pulled back out of Blob and pushed to Drive, which
// takes longer than a default invocation allows for a large file.
export const maxDuration = 300

// Only ever fetch from Blob storage. Without this the route would be an open
// proxy that fetches any URL the caller names.
const BLOB_URL_RE = /^https:\/\/[a-z0-9-]+\.public\.blob\.vercel-storage\.com\//i

interface Body {
  messageId?: unknown
  url?: unknown
  pathname?: unknown
  fileName?: unknown
  contentType?: unknown
  size?: unknown
}

export async function POST(req: Request): Promise<NextResponse> {
  const body = (await req.json().catch(() => null)) as Body | null
  const messageId = typeof body?.messageId === "string" ? body.messageId.trim() : ""
  const url = typeof body?.url === "string" ? body.url : ""
  const pathname = typeof body?.pathname === "string" ? body.pathname : ""
  const fileName = typeof body?.fileName === "string" ? body.fileName.trim() : ""
  const contentType = typeof body?.contentType === "string" && body.contentType ? body.contentType : null
  const size =
    typeof body?.size === "number" && Number.isFinite(body.size) ? Math.max(0, Math.round(body.size)) : 0

  if (!messageId || !url || !pathname || !fileName) {
    return NextResponse.json({ error: "Missing attachment details." }, { status: 400 })
  }
  if (!BLOB_URL_RE.test(url)) {
    return NextResponse.json({ error: "Unrecognised upload location." }, { status: 400 })
  }
  if (size > MAX_UPLOAD_BYTES) {
    return NextResponse.json(
      { error: `${fileName} is over the ${MAX_UPLOAD_LABEL} limit.` },
      { status: 413 }
    )
  }

  // The message determines which conversation (client) this belongs to.
  const msg = await sql`SELECT client_id FROM chat_messages WHERE id = ${messageId}`
  if (msg.rows.length === 0) {
    return NextResponse.json({ error: "That message no longer exists." }, { status: 404 })
  }
  const messageClientId = msg.rows[0].client_id as string

  // Authorize: admin (any) or the client who owns this conversation.
  // Only the client's own attachments are copied to the firm's Drive folder.
  const admin = await requireAdmin()
  let isClientUpload = false
  if (admin.status !== "ok") {
    const client = await getPortalClient()
    if (!client?.clientId || String(client.clientId) !== messageClientId) {
      return NextResponse.json({ error: "You can't attach files to that conversation." }, { status: 403 })
    }
    // Client branch only - the firm can still attach files to an archived
    // client's conversation.
    const gate = await assertClientCanWrite()
    if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status })
    isClientUpload = true
  }

  try {
    // The browser could only create a PUBLIC blob. Attachments are kept and
    // served later through the authorised [id] route, so the public copy is
    // only ever staging: restore it privately and drop the public one before
    // anything is recorded. Done BEFORE the insert so a blob that can't be read
    // leaves no row pointing at nothing.
    let stored: PrivateBlob
    try {
      stored = await moveToPrivateBlob({ stagingUrl: url, pathname, contentType })
    } catch (e) {
      console.error("[message-files] private store failed:", e instanceof Error ? e.message : e)
      return NextResponse.json(
        { error: "We couldn't read that upload. Please try attaching it again." },
        { status: 502 }
      )
    }
    const buffer = stored.buffer

    const ins = await sql`
      INSERT INTO message_attachments (message_id, client_id, file_name, pathname, url, content_type, size)
      VALUES (${messageId}, ${messageClientId}, ${fileName}, ${stored.pathname}, ${stored.url}, ${contentType}, ${size})
      RETURNING id, file_name
    `

    // Deliver to the firm's Drive folder. Fail-soft - the portal copy is saved,
    // so a Drive problem must never lose the attachment the person just sent.
    let delivered = true
    if (isClientUpload) {
      const out = await deliverClientUpload({
        clientId: messageClientId,
        fileName,
        buffer,
        mimeType: contentType,
      })
      delivered = out.delivered
    }

    return NextResponse.json({ attachment: ins.rows[0], delivered }, { status: 201 })
  } catch (e) {
    console.error("[message-files] attach failed:", e instanceof Error ? e.message : e)
    return NextResponse.json(
      { error: "We couldn't attach that file. Please try again." },
      { status: 500 }
    )
  }
}
