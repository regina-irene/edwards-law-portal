// app/api/task-files/[id]/route.ts - download (stream) or delete an attachment
import { auth } from "@/auth"
import { requireAdmin } from "@/lib/admin"
import { getClientByEmail } from "@/lib/airtable"
import { assertClientCanWrite } from "@/lib/client-write-guard"
import { sql } from "@/lib/db"
import { recordFileView } from "@/lib/file-views"
import { get, del } from "@vercel/blob"
import { NextResponse } from "next/server"

async function loadAttachment(id: string) {
  const r = await sql`SELECT * FROM task_attachments WHERE id = ${id}`
  return r.rows[0] ?? null
}

async function clientIdForRequest(): Promise<string | null> {
  const session = await auth()
  if (!session?.user?.email) return null
  const client = await getClientByEmail(session.user.email)
  return client?.clientId ? String(client.clientId) : null
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const att = await loadAttachment(id)
  if (!att) return new NextResponse("Not found", { status: 404 })

  let allowed = false
  let viewerRole: "client" | "firm" = "client"
  let viewerEmail: string | null = null
  let viewerClientId: string | null = null
  const adminCheck = await requireAdmin()
  if (adminCheck.status === "ok") {
    allowed = true
    viewerRole = "firm"
    viewerEmail = adminCheck.email
  } else {
    const cid = await clientIdForRequest()
    if (cid) {
      viewerClientId = cid
      if (att.scope === "client_task") {
        allowed = att.client_id === cid
      } else if (att.scope === "template") {
        const a = await sql`SELECT 1 FROM client_tasks WHERE client_id = ${cid} AND template_id = ${att.ref_id} LIMIT 1`
        allowed = a.rows.length > 0
      }
    }
  }
  if (!allowed) return new NextResponse("Forbidden", { status: 403 })

  const result = await get(att.pathname, { access: "private" })
  if (!result || result.statusCode !== 200) return new NextResponse("Not found", { status: 404 })

  // Log the open only once the file is really being served.
  await recordFileView({
    scope: "task",
    fileId: id,
    clientId: viewerRole === "firm" ? (att.client_id ? String(att.client_id) : null) : viewerClientId,
    viewerEmail,
    viewerRole,
  })

  return new NextResponse(result.stream, {
    headers: {
      "Content-Type": att.content_type || result.blob.contentType || "application/octet-stream",
      "Content-Disposition": `inline; filename="${att.file_name.replace(/"/g, "")}"`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-cache",
    },
  })
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const att = await loadAttachment(id)
  if (!att) return NextResponse.json({ ok: true })

  let allowed = false
  const adminCheck = await requireAdmin()
  if (adminCheck.status === "ok") {
    allowed = true
  } else {
    const cid = await clientIdForRequest()
    allowed = att.scope === "client_task" && cid != null && att.client_id === cid
    // Removing a file is a write. An archived client keeps the download link
    // (GET above) but can no longer take anything back out of their file. The
    // firm's own DELETE is unaffected.
    if (allowed) {
      const gate = await assertClientCanWrite()
      if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status })
    }
  }
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  try { await del(att.url) } catch (e) { console.error("[task-files] blob del failed:", e) }
  await sql`DELETE FROM task_attachments WHERE id = ${id}`
  return NextResponse.json({ ok: true })
}
