// app/api/tasks/route.ts
import { auth } from "@/auth"
import { getClientByEmail } from "@/lib/airtable"
import { getPortalClient } from "@/lib/portal-client"
import { assertClientCanWrite } from "@/lib/client-write-guard"
import { sql } from "@/lib/db"
import { getTemplateAttachments, getClientTaskAttachments } from "@/lib/task-attachments"
import { NextResponse } from "next/server"

export async function GET() {
  // Honors admin preview so a previewed client's tasks render too.
  const client = await getPortalClient()
  if (!client?.clientId) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  const cid = String(client.clientId)

  try {
    const result = await sql`
      SELECT ct.id, ct.template_id, ct.title, ct.description, ct.status, ct.due_date,
             ct.stage, ct.tag, ct.stage_order, ct.sort_order, ct.created_at,
             COALESCE(ct.notes, tt.notes) AS notes,
             COALESCE(ct.form_key, tt.form_key) AS form_key,
             COALESCE(ct.embed_url, tt.embed_url) AS embed_url
      FROM client_tasks ct
      LEFT JOIN task_templates tt ON tt.id = ct.template_id
      WHERE ct.client_id = ${cid}
      ORDER BY ct.stage_order ASC, ct.sort_order ASC, ct.created_at ASC
    `
    const rows = result.rows
    const templateIds = rows.map((r) => r.template_id).filter(Boolean)
    const taskIds = rows.map((r) => r.id)
    const [byTemplate, byTask] = await Promise.all([
      getTemplateAttachments(templateIds),
      getClientTaskAttachments(taskIds, cid),
    ])
    // A template's files are always the firm's. A client_task file can be
    // either: the client's own upload, or one the firm attached to a custom
    // one-off task. Splitting them keeps the firm's file out of "Your uploads",
    // where the client would be offered a Remove button for it.
    const tasks = rows.map((r) => {
      const onTask = byTask[r.id] ?? []
      return {
        ...r,
        firmFiles: [
          ...(r.template_id ? byTemplate[r.template_id] ?? [] : []),
          ...onTask.filter((f) => f.by_firm),
        ],
        myFiles: onTask.filter((f) => !f.by_firm),
      }
    })
    return NextResponse.json({ tasks })
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function PATCH(req: Request) {
  const session = await auth()
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const client = await getClientByEmail(session.user.email)
  if (!client?.clientId) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  // Ticking a task off is a write: an archived client's checklist is frozen.
  const gate = await assertClientCanWrite()
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status })

  let id: unknown, status: unknown
  try {
    const parsed = await req.json()
    id = parsed?.id
    status = parsed?.status
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  if (typeof id !== "string" || !id || !["pending", "done"].includes(status as string)) {
    return NextResponse.json({ error: "id and valid status required" }, { status: 400 })
  }

  try {
    const result = await sql`
      UPDATE client_tasks
      SET status = ${status as string},
          completed_at = CASE WHEN ${status as string} = 'done' THEN NOW() ELSE NULL END
      WHERE id = ${id} AND client_id = ${String(client.clientId)}
      RETURNING id, status
    `
    if (result.rows.length === 0) return NextResponse.json({ error: "Not found" }, { status: 404 })
    return NextResponse.json({ task: result.rows[0] })
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
