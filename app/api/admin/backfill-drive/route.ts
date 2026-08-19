// app/api/admin/backfill-drive/route.ts - catch-up delivery to Google Drive.
// Client uploads have gone to Drive automatically since 2026-08-13; this walks
// the ones that landed in the portal before that (and retries any that failed)
// and copies them into the client's Drive folder. Admin-only, and safe to run
// again: anything already delivered is skipped.
import { requireAdmin } from "@/lib/admin"
import { sql } from "@/lib/db"
import { deliverClientUpload, driveConfigured } from "@/lib/client-uploads"
import { get } from "@vercel/blob"
import { NextResponse } from "next/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

interface Pending {
  source: "task" | "message"
  clientId: string
  fileName: string
  pathname: string
  contentType: string | null
}

async function alreadyDelivered(clientId: string, fileName: string): Promise<boolean> {
  const r = await sql`
    SELECT 1 FROM dropzone_files
    WHERE uploaded_by = ${clientId} AND file_name = ${fileName} AND drive_status = 'delivered'
    LIMIT 1
  `
  return r.rows.length > 0
}

export async function GET() {
  const check = await requireAdmin()
  if (check.status === "unauthenticated") return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (check.status === "forbidden") return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  if (!driveConfigured()) {
    return NextResponse.json({ error: "Google Drive isn't configured on this deployment." }, { status: 503 })
  }

  // Client task uploads: anyone who isn't an admin uploaded them.
  const tasks = await sql`
    SELECT client_id, file_name, pathname, content_type FROM task_attachments
    WHERE scope = 'client_task' AND client_id IS NOT NULL
      AND (uploaded_by IS NULL OR uploaded_by NOT IN (SELECT email FROM admin_users))
    ORDER BY created_at ASC
  `.catch(() => ({ rows: [] as Record<string, unknown>[] }))

  // Message attachments the client sent.
  const messages = await sql`
    SELECT ma.client_id, ma.file_name, ma.pathname, ma.content_type
    FROM message_attachments ma JOIN chat_messages cm ON cm.id = ma.message_id
    WHERE cm.sender = 'client'
    ORDER BY ma.created_at ASC
  `.catch(() => ({ rows: [] as Record<string, unknown>[] }))

  const pending: Pending[] = [
    ...tasks.rows.map((r): Pending => ({ source: "task", clientId: String(r.client_id), fileName: String(r.file_name), pathname: String(r.pathname), contentType: r.content_type ? String(r.content_type) : null })),
    ...messages.rows.map((r): Pending => ({ source: "message", clientId: String(r.client_id), fileName: String(r.file_name), pathname: String(r.pathname), contentType: r.content_type ? String(r.content_type) : null })),
  ]

  const delivered: string[] = []
  const skipped: string[] = []
  const failed: string[] = []

  for (const item of pending) {
    if (await alreadyDelivered(item.clientId, item.fileName)) {
      skipped.push(item.fileName)
      continue
    }
    try {
      const blob = await get(item.pathname, { access: "private" })
      if (!blob || blob.statusCode !== 200) {
        failed.push(`${item.fileName} (not in portal storage)`)
        continue
      }
      const buffer = Buffer.from(await new Response(blob.stream).arrayBuffer())
      const result = await deliverClientUpload({
        clientId: item.clientId,
        fileName: item.fileName,
        buffer,
        mimeType: item.contentType,
      })
      if (result.delivered) delivered.push(item.fileName)
      else failed.push(item.fileName)
    } catch (e) {
      console.error("[backfill-drive] failed for", item.fileName, e instanceof Error ? e.message : e)
      failed.push(item.fileName)
    }
  }

  return NextResponse.json({
    checked: pending.length,
    copiedToDrive: delivered.length,
    alreadyThere: skipped.length,
    couldNotCopy: failed.length,
    delivered,
    skipped,
    failed,
  })
}
