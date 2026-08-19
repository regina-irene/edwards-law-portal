// app/api/task-files/route.ts — upload a file attachment to a task
import { auth } from "@/auth"
import { requireAdmin } from "@/lib/admin"
import { getClientByEmail } from "@/lib/airtable"
import { assertClientCanWrite } from "@/lib/client-write-guard"
import { sql } from "@/lib/db"
import { deliverClientUpload } from "@/lib/client-uploads"
import { put } from "@vercel/blob"
import { NextResponse } from "next/server"

export const runtime = "nodejs"

const MAX_BYTES = 25 * 1024 * 1024 // 25MB

export async function POST(req: Request) {
  const form = await req.formData().catch(() => null)
  if (!form) return NextResponse.json({ error: "Invalid form" }, { status: 400 })

  const file = form.get("file")
  const scope = form.get("scope")
  const refId = form.get("refId")

  if (!(file instanceof File) || (scope !== "template" && scope !== "client_task") || typeof refId !== "string" || !refId) {
    return NextResponse.json({ error: "file, scope, refId required" }, { status: 400 })
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "File too large (max 25MB)" }, { status: 413 })
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
      if (r.rows.length === 0) return NextResponse.json({ error: "Task not found" }, { status: 404 })
      clientId = r.rows[0].client_id
    }
  } else {
    const session = await auth()
    if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const client = await getClientByEmail(session.user.email)
    if (!client?.clientId) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    if (scope !== "client_task") return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    // Client branch only — the admin branch above stays open, because the firm
    // must still be able to work an archived client's file.
    const gate = await assertClientCanWrite()
    if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status })
    const cid = String(client.clientId)
    const r = await sql`SELECT id FROM client_tasks WHERE id = ${refId} AND client_id = ${cid}`
    if (r.rows.length === 0) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    actorEmail = session.user.email
    clientId = cid
    isClientUpload = true
  }

  try {
    const safeName = file.name.replace(/[^\w.\-]+/g, "_") || "file"
    // Read the bytes once: the portal copy and the Drive copy share them.
    const buffer = Buffer.from(await file.arrayBuffer())
    const blob = await put(`tasks/${scope}/${refId}/${safeName}`, buffer, {
      access: "private",
      contentType: file.type || undefined,
    })
    const ins = await sql`
      INSERT INTO task_attachments (scope, ref_id, client_id, file_name, pathname, url, content_type, size, uploaded_by)
      VALUES (${scope}, ${refId}, ${clientId}, ${file.name}, ${blob.pathname}, ${blob.url}, ${file.type || null}, ${file.size}, ${actorEmail})
      RETURNING id, scope, ref_id, file_name, content_type, size, created_at
    `
    // Deliver to the firm's Drive folder. Fail-soft — the portal copy is saved.
    if (isClientUpload && clientId) {
      await deliverClientUpload({ clientId, fileName: file.name, buffer, mimeType: file.type })
    }
    return NextResponse.json({ attachment: ins.rows[0] }, { status: 201 })
  } catch (e) {
    console.error("[task-files] upload failed:", e)
    return NextResponse.json({ error: "Upload failed" }, { status: 500 })
  }
}
