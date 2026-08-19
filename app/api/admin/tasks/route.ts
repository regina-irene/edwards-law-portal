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
      sql`SELECT id, title, description, stage, tag, notes, form_key, embed_url, stage_order, sort_order, created_at
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

  let action: unknown, title: unknown, description: unknown, clientId: unknown, templateId: unknown, templateIds: unknown, dueDate: unknown, stage: unknown, tag: unknown
  try {
    const parsed = await req.json()
    action = parsed?.action
    title = parsed?.title
    description = parsed?.description
    clientId = parsed?.clientId
    templateId = parsed?.templateId
    templateIds = parsed?.templateIds
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

  // Copy a task (with its linked form, embed and notes) into another stage,
  // instead of retyping it there.
  if (action === "copy_template") {
    const sourceId = typeof templateId === "string" ? templateId : ""
    const toStage = typeof stage === "string" && stage.trim() ? stage.trim() : ""
    if (!sourceId || !toStage) return NextResponse.json({ error: "templateId and stage required" }, { status: 400 })
    try {
      const src = await sql`
        SELECT title, description, tag, notes, form_key, embed_url FROM task_templates WHERE id = ${sourceId}
      `
      if (src.rows.length === 0) return NextResponse.json({ error: "Not found" }, { status: 404 })
      const t = src.rows[0]
      // Land at the end of the target stage, reusing that stage's order.
      const ord = await sql`
        SELECT
          COALESCE(MAX(stage_order), (SELECT COALESCE(MAX(stage_order) + 1, 0) FROM task_templates)) AS stage_order,
          COALESCE(MAX(sort_order) + 1, 0) AS sort_order
        FROM task_templates WHERE stage = ${toStage}
      `
      const result = await sql`
        INSERT INTO task_templates (title, description, stage, tag, notes, form_key, embed_url, stage_order, sort_order)
        VALUES (${t.title}, ${t.description}, ${toStage}, ${t.tag}, ${t.notes}, ${t.form_key}, ${t.embed_url},
                ${ord.rows[0]?.stage_order ?? 0}, ${ord.rows[0]?.sort_order ?? 0})
        RETURNING id, title, stage
      `
      return NextResponse.json({ template: result.rows[0] }, { status: 201 })
    } catch (e) {
      console.error("[admin/tasks] copy failed:", e)
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
    // one or many templates per assign
    const taskTemplateIds: string[] = Array.isArray(templateIds)
      ? templateIds.filter((x): x is string => typeof x === "string" && Boolean(x))
      : taskTemplateId
        ? [taskTemplateId]
        : []

    if (!taskTitle && taskTemplateIds.length === 0) {
      return NextResponse.json({ error: "title or templateIds required" }, { status: 400 })
    }

    try {
      // custom one-off task (no template)
      if (taskTitle) {
        const finalStage = typeof stage === "string" && stage.trim() ? stage.trim() : null
        const finalTag = typeof tag === "string" && tag.trim() ? tag.trim() : null
        const result = await sql`
          INSERT INTO client_tasks (client_id, template_id, title, description, due_date, stage, tag, stage_order, sort_order)
          VALUES (${clientId}, ${taskTemplateId}, ${taskTitle}, ${taskDesc}, ${taskDueDate}, ${finalStage}, ${finalTag}, 0, 0)
          RETURNING id, client_id, title, description, status, due_date, stage, tag, stage_order, sort_order, created_at
        `
        return NextResponse.json({ task: result.rows[0], tasks: result.rows }, { status: 201 })
      }

      // template-based: assign every selected template in one round trip.
      // Was a SELECT + INSERT per template (2026-08-18), so assigning a whole
      // stage meant 30+ sequential queries. Unnesting the id list WITH
      // ORDINALITY (rather than a plain id = ANY) keeps the old loop's exact
      // behaviour: the join drops ids with no template, the ordinal keeps the
      // caller's ordering so created[0] is still the first id they sent.
      const assigned = await sql`
        INSERT INTO client_tasks (client_id, template_id, title, description, due_date, stage, tag, stage_order, sort_order)
        SELECT ${clientId}::text, t.id, t.title, t.description, ${taskDueDate}::date, t.stage, t.tag,
               COALESCE(t.stage_order, 0), COALESCE(t.sort_order, 0)
        FROM unnest(${taskTemplateIds as any}::uuid[]) WITH ORDINALITY AS req(template_id, ord)
        JOIN task_templates t ON t.id = req.template_id
        ORDER BY req.ord
        RETURNING id, client_id, title, description, status, due_date, stage, tag, stage_order, sort_order, created_at
      `
      const created = assigned.rows
      if (created.length === 0) return NextResponse.json({ error: "Template not found" }, { status: 404 })
      return NextResponse.json({ task: created[0], tasks: created }, { status: 201 })
    } catch {
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 })
}

export async function PATCH(req: Request) {
  const check = await requireAdmin()
  if (check.status !== "ok") return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  let id: unknown, title: unknown, tag: unknown, oldStage: unknown, newStage: unknown, notes: unknown, formKey: unknown, embedUrl: unknown, taskId: unknown, dueDate: unknown, status: unknown, moveToStage: unknown
  try {
    const parsed = await req.json()
    status = parsed?.status
    moveToStage = parsed?.moveToStage
    id = parsed?.id
    title = parsed?.title
    tag = parsed?.tag
    oldStage = parsed?.oldStage
    newStage = parsed?.newStage
    notes = parsed?.notes
    formKey = parsed?.formKey
    embedUrl = parsed?.embedUrl
    taskId = parsed?.taskId
    dueDate = parsed?.dueDate
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  // Mark an assigned task done (or reopen it) from the admin side. Mirrors the
  // client's own PATCH /api/tasks so completed_at stays consistent — Field
  // Notes reads that column for its "task completed" entries.
  if (typeof taskId === "string" && taskId && typeof status === "string") {
    if (!["pending", "done"].includes(status)) {
      return NextResponse.json({ error: "status must be pending or done" }, { status: 400 })
    }
    try {
      const result = await sql`
        UPDATE client_tasks
        SET status = ${status},
            completed_at = CASE WHEN ${status} = 'done' THEN NOW() ELSE NULL END
        WHERE id = ${taskId}
        RETURNING id, client_id, title, description, status, due_date, stage, tag, stage_order, sort_order, created_at
      `
      if (result.rows.length === 0) return NextResponse.json({ error: "Not found" }, { status: 404 })
      return NextResponse.json({ task: result.rows[0] })
    } catch {
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
  }

  // Change (or clear) the due date on a task already assigned to a client.
  if (typeof taskId === "string" && taskId && dueDate !== undefined) {
    const due = typeof dueDate === "string" && dueDate.trim() ? dueDate.trim() : null
    if (due && !/^\d{4}-\d{2}-\d{2}$/.test(due)) {
      return NextResponse.json({ error: "dueDate must be YYYY-MM-DD" }, { status: 400 })
    }
    try {
      const result = await sql`
        UPDATE client_tasks SET due_date = ${due} WHERE id = ${taskId}
        RETURNING id, client_id, title, description, status, due_date, stage, tag, stage_order, sort_order, created_at
      `
      if (result.rows.length === 0) return NextResponse.json({ error: "Not found" }, { status: 404 })
      return NextResponse.json({ task: result.rows[0] })
    } catch {
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
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

  // Set/clear an embedded form URL on a task (e.g. an Airtable form)
  if (typeof id === "string" && id && embedUrl !== undefined) {
    const raw = typeof embedUrl === "string" ? embedUrl.trim() : ""
    const url = raw && /^https?:\/\//i.test(raw) ? raw : raw ? `https://${raw}` : null
    try {
      await sql`UPDATE task_templates SET embed_url = ${url} WHERE id = ${id}`
      return NextResponse.json({ ok: true })
    } catch {
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
  }

  // Move a task to another stage: it keeps its title, tag, notes and linked
  // form, and lands at the end of the stage it moves to.
  if (typeof id === "string" && id && typeof moveToStage === "string" && moveToStage.trim()) {
    const toStage = moveToStage.trim()
    try {
      const ord = await sql`
        SELECT
          COALESCE(MAX(stage_order), (SELECT COALESCE(MAX(stage_order) + 1, 0) FROM task_templates)) AS stage_order,
          COALESCE(MAX(sort_order) + 1, 0) AS sort_order
        FROM task_templates WHERE stage = ${toStage}
      `
      const result = await sql`
        UPDATE task_templates
        SET stage = ${toStage}, stage_order = ${ord.rows[0]?.stage_order ?? 0}, sort_order = ${ord.rows[0]?.sort_order ?? 0}
        WHERE id = ${id}
        RETURNING id, title, stage
      `
      if (result.rows.length === 0) return NextResponse.json({ error: "Not found" }, { status: 404 })
      return NextResponse.json({ template: result.rows[0] })
    } catch (e) {
      console.error("[admin/tasks] move failed:", e)
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
