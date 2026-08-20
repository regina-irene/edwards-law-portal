// app/api/message-files/route.ts - record a message attachment the browser has
// already put in Vercel Blob (2026-08-20).
//
// This route used to take the file itself as multipart form data. Vercel refuses
// any serverless REQUEST BODY over ~4.5 MB before the handler runs, so a bigger
// attachment came back as a bare 413 while the composer promised 25 MB. The
// bytes now go from the browser straight to Blob and only the resulting URL is
// posted here, which is a few hundred bytes of JSON.
//
// The browser writes the blob PRIVATELY and it stays exactly where it landed.
// It is deliberately NOT re-uploaded and NOT deleted here: message_attachments
// .url points at it and /api/message-files/[id] streams it back later, through
// its own authorisation check.
import { requireAdmin } from "@/lib/admin"
import { getPortalClient } from "@/lib/portal-client"
import { assertClientCanWrite } from "@/lib/client-write-guard"
import { sql } from "@/lib/db"
import { deliverClientUpload } from "@/lib/client-uploads"
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_LABEL } from "@/lib/upload-limits"
import { readBlobBytes } from "@/lib/blob-read"
import { NextResponse } from "next/server"

export const runtime = "nodejs"
// A client's attachment is pulled back out of Blob and pushed to Drive, which
// takes longer than a default invocation allows for a large file.
export const maxDuration = 300

// Only ever read from Blob storage. Without this the route would be an open
// proxy that reads any URL the caller names. New uploads are private; the
// public form is still allowed because rows written earlier point at it.
const BLOB_URL_RE = /^https:\/\/[a-z0-9-]+\.(public|private)\.blob\.vercel-storage\.com\//i

// `pathname` is NOT accepted from the caller. It used to be, which meant a
// caller could post their own url with someone else's pathname and have the
// row (and every later read) point somewhere they should not reach. It is
// derived from the url below instead.
interface Body {
  messageId?: unknown
  url?: unknown
  fileName?: unknown
  contentType?: unknown
  size?: unknown
}

export async function POST(req: Request): Promise<NextResponse> {
  const body = (await req.json().catch(() => null)) as Body | null
  const messageId = typeof body?.messageId === "string" ? body.messageId.trim() : ""
  const url = typeof body?.url === "string" ? body.url : ""
  const fileName = typeof body?.fileName === "string" ? body.fileName.trim() : ""
  const contentType = typeof body?.contentType === "string" && body.contentType ? body.contentType : null
  const size =
    typeof body?.size === "number" && Number.isFinite(body.size) ? Math.max(0, Math.round(body.size)) : 0

  if (!messageId || !url || !fileName) {
    return NextResponse.json({ error: "Missing attachment details." }, { status: 400 })
  }
  if (!BLOB_URL_RE.test(url)) {
    return NextResponse.json({ error: "Unrecognised upload location." }, { status: 400 })
  }
  // Derived, never taken from the body. The regex above has already confirmed
  // this parses as a blob URL, but new URL() is guarded all the same.
  let pathname: string
  try {
    pathname = new URL(url).pathname.replace(/^\//, "")
  } catch {
    return NextResponse.json({ error: "Unrecognised upload location." }, { status: 400 })
  }
  if (!pathname) {
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
    // The blob is already private and already where it belongs, so nothing is
    // copied or moved here. Only a client's attachment also goes to Drive, and
    // that is the only reason to pull the bytes back at all: the firm's own
    // attachment never needs to be read on this request.
    let buffer: Buffer | null = null
    if (isClientUpload) {
      try {
        buffer = await readBlobBytes(url)
      } catch (e) {
        console.error("[message-files] blob read failed:", e instanceof Error ? e.message : e)
        return NextResponse.json(
          { error: "We couldn't read that upload. Please try attaching it again." },
          { status: 502 }
        )
      }
    }

    const ins = await sql`
      INSERT INTO message_attachments (message_id, client_id, file_name, pathname, url, content_type, size)
      VALUES (${messageId}, ${messageClientId}, ${fileName}, ${pathname}, ${url}, ${contentType}, ${size})
      RETURNING id, file_name
    `

    // Deliver to the firm's Drive folder. Fail-soft - the portal copy is saved,
    // so a Drive problem must never lose the attachment the person just sent.
    let delivered = true
    if (isClientUpload && buffer) {
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
