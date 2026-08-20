// app/api/task-files/route.ts - record a task attachment the browser has
// already put in Vercel Blob (2026-08-20).
//
// This route used to take the file itself as multipart form data. Vercel refuses
// any serverless REQUEST BODY over ~4.5 MB before the handler runs, so a bigger
// file came back as a bare 413 while the screen promised 25 MB. The bytes now go
// from the browser straight to Blob and only the resulting URL is posted here.
//
// A browser upload token can only mint a PUBLIC blob, so that copy is staging
// only. The bytes are restored to a PRIVATE blob here and the public one is
// deleted, because these are client financial documents and an unguessable URL
// is not access control. The row points at the private blob, which
// /api/task-files/[id] streams back through its own authorisation check.
import { auth } from "@/auth"
import { requireAdmin } from "@/lib/admin"
import { getClientByEmail } from "@/lib/airtable"
import { assertClientCanWrite } from "@/lib/client-write-guard"
import { sql } from "@/lib/db"
import { deliverClientUpload } from "@/lib/client-uploads"
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_LABEL } from "@/lib/upload-limits"
import { moveToPrivateBlob, type PrivateBlob } from "@/lib/blob-private"
import { NextResponse } from "next/server"

export const runtime = "nodejs"
// A client's file is pulled back out of Blob and pushed to Drive, which takes
// longer than a default invocation allows for a large file.
export const maxDuration = 300

// Only ever fetch from Blob storage. Without this the route would be an open
// proxy that fetches any URL the caller names.
const BLOB_URL_RE = /^https:\/\/[a-z0-9-]+\.public\.blob\.vercel-storage\.com\//i

type Scope = "template" | "client_task"

interface Body {
  scope?: unknown
  refId?: unknown
  url?: unknown
  pathname?: unknown
  fileName?: unknown
  contentType?: unknown
  size?: unknown
}

export async function POST(req: Request): Promise<NextResponse> {
  const body = (await req.json().catch(() => null)) as Body | null
  const rawScope = body?.scope
  const scope: Scope | null =
    rawScope === "template" || rawScope === "client_task" ? rawScope : null
  const refId = typeof body?.refId === "string" ? body.refId.trim() : ""
  const url = typeof body?.url === "string" ? body.url : ""
  const pathname = typeof body?.pathname === "string" ? body.pathname : ""
  const fileName = typeof body?.fileName === "string" ? body.fileName.trim() : ""
  const contentType = typeof body?.contentType === "string" && body.contentType ? body.contentType : null
  const size =
    typeof body?.size === "number" && Number.isFinite(body.size) ? Math.max(0, Math.round(body.size)) : 0

  if (!scope || !refId || !url || !pathname || !fileName) {
    return NextResponse.json({ error: "Missing upload details." }, { status: 400 })
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

  // Authorize the uploader
  let actorEmail: string
  let clientId: string | null = null
  // Only files the CLIENT sends in are copied to the firm's Drive folder.
  let isClientUpload = false
  const adminCheck = await requireAdmin()
  if (adminCheck.status === "ok") {
    actorEmail = adminCheck.email
    if (scope === "client_task") {
      const r = await sql`SELECT client_id FROM client_tasks WHERE id = ${refId}`
      if (r.rows.length === 0) return NextResponse.json({ error: "That task no longer exists." }, { status: 404 })
      clientId = r.rows[0].client_id
    }
  } else {
    const session = await auth()
    if (!session?.user?.email) return NextResponse.json({ error: "Please sign in again." }, { status: 401 })
    const client = await getClientByEmail(session.user.email)
    if (!client?.clientId) return NextResponse.json({ error: "You can't upload to that task." }, { status: 403 })
    if (scope !== "client_task") return NextResponse.json({ error: "You can't upload to that task." }, { status: 403 })
    // Client branch only - the admin branch above stays open, because the firm
    // must still be able to work an archived client's file.
    const gate = await assertClientCanWrite()
    if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status })
    const cid = String(client.clientId)
    const r = await sql`SELECT id FROM client_tasks WHERE id = ${refId} AND client_id = ${cid}`
    if (r.rows.length === 0) return NextResponse.json({ error: "You can't upload to that task." }, { status: 403 })
    actorEmail = session.user.email
    clientId = cid
    isClientUpload = true
  }

  try {
    // Restore the staging blob privately BEFORE writing the row: a blob that
    // can't be read then leaves nothing behind and the person can try again.
    // Client financial documents must not stay in a publicly readable URL.
    let stored: PrivateBlob
    try {
      stored = await moveToPrivateBlob({ stagingUrl: url, pathname, contentType })
    } catch (e) {
      console.error("[task-files] private store failed:", e instanceof Error ? e.message : e)
      return NextResponse.json(
        { error: "We couldn't read that upload. Please try again." },
        { status: 502 }
      )
    }
    const buffer = stored.buffer

    const ins = await sql`
      INSERT INTO task_attachments (scope, ref_id, client_id, file_name, pathname, url, content_type, size, uploaded_by)
      VALUES (${scope}, ${refId}, ${clientId}, ${fileName}, ${stored.pathname}, ${stored.url}, ${contentType}, ${size}, ${actorEmail})
      RETURNING id, scope, ref_id, file_name, content_type, size, created_at
    `

    // Deliver to the firm's Drive folder. Fail-soft - the portal copy is saved,
    // so a Drive problem must never lose the file the client just sent.
    let delivered = true
    if (isClientUpload && clientId) {
      const out = await deliverClientUpload({ clientId, fileName, buffer, mimeType: contentType })
      delivered = out.delivered
    }

    return NextResponse.json({ attachment: ins.rows[0], delivered }, { status: 201 })
  } catch (e) {
    console.error("[task-files] upload failed:", e instanceof Error ? e.message : e)
    return NextResponse.json(
      { error: "We couldn't save that file. Please try again." },
      { status: 500 }
    )
  }
}
