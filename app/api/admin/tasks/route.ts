// app/api/admin/tasks/route.ts
import { requireAdmin } from "@/lib/admin"
import { sql } from "@/lib/db"
import { sanitizeNotesHtml } from "@/lib/sanitize"
import { getTemplateAttachments } from "@/lib/task-attachments"
import { NextResponse } from "next/server"

export async function GET() {
  const check = await requireAdmin()
  if (check.status !== "ok") return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const [templates, tasks] = await Promise.all([
      sql`SELECT id, title, description, stage, tag, notes, form_key, stage_order, sort_order, created_at
          FROM task_templates ORDER BY stage_order ASC, sort_order ASC, created_at ASC`,
      sql`SELECT id, client_id, title, description, status, due_date, stage, tag, stage_order, sort_order, created_at
          FROM client_tasks ORDER BY client_id ASC, stage_order ASC, sort_order ASC, created_at DESC`,
    ])
    const attachmentsByTemplate = await getTemplateAttachments(templates.rows.map((t) => t.id))
    return NextResponse.json({ templates: templates.rows, tasks: tasks.rows, attachmentsByTemplate })
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(req: Request) {
  const check = await requireAdmin()
  if (check.status !== "ok") return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  let action: unknown, title: unknown, description: unknown, clientId: unknown, templateId: unknown, dueDate: unknown, stage: unknown, tag: unknown
  try {
    const parsed = await req.json()
    action = parsed?.action
    title = parsed?.title
    description = parsed?.description
    clientId = parsed?.clientId
    templateId = parsed?.templateId
    dueDate = parsed?.dueDate
    stage = parsed?.stage
    tag = parsed?.tag
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  if (action === "create_template") {
    if (typeof title !== "string" || !title.trim()) {
      return NextResponse.json({ error: "title required" }, { status: 400 })
    }
    const stageName = typeof stage === "string" && stage.trim() ? stage.trim() : "Other"
    const tagVal = typeof tag === "string" && tag.trim() ? tag.trim() : null
    try {
      // Place the new task at the end of its stage, reusing the stage's order.
      const ord = await sql`
        SELECT
          COALESCE(MAX(stage_order), (SELECT COALESCE(MAX(stage_order) + 1, 0) FROM task_templates)) AS stage_order,
          COALESCE(MAX(sort_order) + 1, 0) AS sort_order
        FROM task_templates WHERE stage = ${stageName}
      `
      const stageOrder = ord.rows[0]?.stage_order ?? 0
      const sortOrder = ord.rows[0]?.sort_order ?? 0
      const result = await sql`
        INSERT INTO task_templates (title, description, stage, tag, stage_order, sort_order)
        VALUES (${title.trim()}, ${typeof description === "string" ? description.trim() || null : null},
                ${stageName}, ${tagVal}, ${stageOrder}, ${sortOrder})
        RETURNING id, title, description, stage, tag, stage_order, sort_order, created_at
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
      let finalStage: string | null = typeof stage === "string" && stage.trim() ? stage.trim() : null
      let finalTag: string | null = typeof tag === "string" && tag.trim() ? tag.trim() : null
      let finalStageOrder = 0
      let finalSortOrder = 0
      if (taskTemplateId && !taskTitle) {
        const tmpl = await sql`SELECT title, description, stage, tag, stage_order, sort_order FROM task_templates WHERE id = ${taskTemplateId}`
        if (tmpl.rows.length === 0) return NextResponse.json({ error: "Template not found" }, { status: 404 })
        finalTitle = tmpl.rows[0].title
        finalDesc = tmpl.rows[0].description
        finalStage = tmpl.rows[0].stage
        finalTag = tmpl.rows[0].tag
        finalStageOrder = tmpl.rows[0].stage_order ?? 0
        finalSortOrder = tmpl.rows[0].sort_order ?? 0
      }

      const result = await sql`
        INSERT INTO client_tasks (client_id, template_id, title, description, due_date, stage, tag, stage_order, sort_order)
        VALUES (${clientId}, ${taskTemplateId}, ${finalTitle!}, ${finalDesc}, ${taskDueDate}, ${finalStage}, ${finalTag}, ${finalStageOrder}, ${finalSortOrder})
        RETURNING id, client_id, title, description, status, due_date, stage, tag, stage_order, sort_order, created_at
      `
      return NextResponse.json({ task: result.rows[0] }, { status: 201 })
    } catch {
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 })
}

export async function PATCH(req: Request) {
  const check = await requireAdmin()
  if (check.status !== "ok") return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  let id: unknown, title: unknown, tag: unknown, oldStage: unknown, newStage: unknown, notes: unknown, formKey: unknown
  try {
    const parsed = await req.json()
    id = parsed?.id
    title = parsed?.title
    tag = parsed?.tag
    oldStage = parsed?.oldStage
    newStage = parsed?.newStage
    notes = parsed?.notes
    formKey = parsed?.formKey
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  // Link/unlink a FileFlow form to a task (independent of title edits)
  if (typeof id === "string" && id && formKey !== undefined) {
    const fk = typeof formKey === "string" && formKey.trim() ? formKey.trim() : null
    try {
      await sql`UPDATE task_templates SET form_key = ${fk} WHERE id = ${id}`
      return NextResponse.json({ ok: true })
    } catch {
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
  }

  // Rename a stage (category) across templates and assigned tasks.
  if (typeof oldStage === "string" && oldStage && typeof newStage === "string" && newStage.trim()) {
    const to = newStage.trim()
    try {
      await sql`UPDATE task_templates SET stage = ${to} WHERE stage = ${oldStage}`
      await sql`UPDATE client_tasks SET stage = ${to} WHERE stage = ${oldStage}`
      return NextResponse.json({ ok: true })
    } catch {
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
  }

  // Edit a single task template (title + tag).
  if (typeof id !== "string" || !id || typeof title !== "string" || !title.trim()) {
    return NextResponse.json({ error: "id and title required" }, { status: 400 })
  }
  const tagVal = typeof tag === "string" && tag.trim() ? tag.trim() : null

  try {
    // Only overwrite notes when the caller included a notes field.
    const result =
      notes === undefined
        ? await sql`
            UPDATE task_templates SET title = ${title.trim()}, tag = ${tagVal}
            WHERE id = ${id}
            RETURNING id, title, description, stage, tag, notes, stage_order, sort_order, created_at
          `
        : await sql`
            UPDATE task_templates SET title = ${title.trim()}, tag = ${tagVal}, notes = ${sanitizeNotesHtml(notes) || null}
            WHERE id = ${id}
            RETURNING id, title, description, stage, tag, notes, stage_order, sort_order, created_at
          `
    if (result.rows.length === 0) return NextResponse.json({ error: "Not found" }, { status: 404 })
    return NextResponse.json({ template: result.rows[0] })
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
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
