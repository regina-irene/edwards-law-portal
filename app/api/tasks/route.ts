// app/api/tasks/route.ts
import { auth } from "@/auth"
import { getClientByEmail } from "@/lib/airtable"
import { getPortalClient } from "@/lib/portal-client"
import { sql } from "@/lib/db"
import { NextResponse } from "next/server"

export async function GET() {
  // Honors admin preview so a previewed client's tasks render too.
  const client = await getPortalClient()
  if (!client?.clientId) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  try {
    const result = await sql`
      SELECT ct.id, ct.title, ct.description, ct.status, ct.due_date,
             ct.stage, ct.tag, ct.stage_order, ct.sort_order, ct.created_at,
             COALESCE(ct.notes, tt.notes) AS notes
      FROM client_tasks ct
      LEFT JOIN task_templates tt ON tt.id = ct.template_id
      WHERE ct.client_id = ${String(client.clientId)}
      ORDER BY ct.stage_order ASC, ct.sort_order ASC, ct.created_at ASC
    `
    return NextResponse.json({ tasks: result.rows })
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function PATCH(req: Request) {
  const session = await auth()
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const client = await getClientByEmail(session.user.email)
  if (!client?.clientId) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

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
      SET status = ${status as string}
      WHERE id = ${id} AND client_id = ${String(client.clientId)}
      RETURNING id, status
    `
    if (result.rows.length === 0) return NextResponse.json({ error: "Not found" }, { status: 404 })
    return NextResponse.json({ task: result.rows[0] })
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
