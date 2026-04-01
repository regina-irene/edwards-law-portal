// app/api/admin/tasks/route.ts
import { requireAdmin } from "@/lib/admin"
import { sql } from "@/lib/db"
import { NextResponse } from "next/server"

export async function GET() {
  const check = await requireAdmin()
  if (check.status !== "ok") return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const [templates, tasks] = await Promise.all([
      sql`SELECT id, title, description, created_at FROM task_templates ORDER BY created_at ASC`,
      sql`SELECT id, client_id, title, description, status, due_date, created_at FROM client_tasks ORDER BY created_at DESC`,
    ])
    return NextResponse.json({ templates: templates.rows, tasks: tasks.rows })
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(req: Request) {
  const check = await requireAdmin()
  if (check.status !== "ok") return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  let action: unknown, title: unknown, description: unknown, clientId: unknown, templateId: unknown, dueDate: unknown
  try {
    const parsed = await req.json()
    action = parsed?.action
    title = parsed?.title
    description = parsed?.description
    clientId = parsed?.clientId
    templateId = parsed?.templateId
    dueDate = parsed?.dueDate
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  if (action === "create_template") {
    if (typeof title !== "string" || !title.trim()) {
      return NextResponse.json({ error: "title required" }, { status: 400 })
    }
    try {
      const result = await sql`
        INSERT INTO task_templates (title, description)
        VALUES (${title.trim()}, ${typeof description === "string" ? description.trim() || null : null})
        RETURNING id, title, description, created_at
      `
      return NextResponse.json({ template: result.rows[0] }, { status: 201 })
    } catch {
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
  }

  if (action === "assign") {
    if (typeof clientId !== "string" || !clientId) {
      return NextResponse.json({ error: "clientId required" }, { status: 400 })
    }
    const taskTitle = typeof title === "string" && title.trim() ? title.trim() : null
    const taskDesc = typeof description === "string" && description.trim() ? description.trim() : null
    const taskTemplateId = typeof templateId === "string" && templateId ? templateId : null
    const taskDueDate = typeof dueDate === "string" && dueDate ? dueDate : null

    if (!taskTitle && !taskTemplateId) {
      return NextResponse.json({ error: "title or templateId required" }, { status: 400 })
    }

    try {
      let finalTitle = taskTitle
      let finalDesc = taskDesc
      if (taskTemplateId && !taskTitle) {
        const tmpl = await sql`SELECT title, description FROM task_templates WHERE id = ${taskTemplateId}`
        if (tmpl.rows.length === 0) return NextResponse.json({ error: "Template not found" }, { status: 404 })
        finalTitle = tmpl.rows[0].title
        finalDesc = tmpl.rows[0].description
      }

      const result = await sql`
        INSERT INTO client_tasks (client_id, template_id, title, description, due_date)
        VALUES (${clientId}, ${taskTemplateId}, ${finalTitle!}, ${finalDesc}, ${taskDueDate})
        RETURNING id, client_id, title, description, status, due_date, created_at
      `
      return NextResponse.json({ task: result.rows[0] }, { status: 201 })
    } catch {
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 })
}

export async function DELETE(req: Request) {
  const check = await requireAdmin()
  if (check.status !== "ok") return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  let id: unknown, type: unknown
  try {
    const parsed = await req.json()
    id = parsed?.id
    type = parsed?.type
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  if (typeof id !== "string" || !id || !["template", "task"].includes(type as string)) {
    return NextResponse.json({ error: "id and type required" }, { status: 400 })
  }

  try {
    if (type === "template") {
      await sql`DELETE FROM task_templates WHERE id = ${id}`
    } else {
      await sql`DELETE FROM client_tasks WHERE id = ${id}`
    }
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
