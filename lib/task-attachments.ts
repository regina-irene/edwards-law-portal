import { sql } from "./db"

export interface TaskAttachment {
  id: string
  scope: "template" | "client_task"
  ref_id: string
  file_name: string
  content_type: string | null
  size: number | null
  created_at: string
}

function groupByRef(rows: any[]): Record<string, TaskAttachment[]> {
  const m: Record<string, TaskAttachment[]> = {}
  for (const r of rows) (m[r.ref_id] ??= []).push(r)
  return m
}

export async function getTemplateAttachments(
  templateIds: string[]
): Promise<Record<string, TaskAttachment[]>> {
  const ids = templateIds.filter(Boolean)
  if (ids.length === 0) return {}
  const { rows } = await sql`
    SELECT id, scope, ref_id, file_name, content_type, size, created_at
    FROM task_attachments
    WHERE scope = 'template' AND ref_id = ANY(${ids as any}::text[])
    ORDER BY created_at ASC
  `
  return groupByRef(rows)
}

export async function getClientTaskAttachments(
  taskIds: string[],
  clientId: string
): Promise<Record<string, TaskAttachment[]>> {
  const ids = taskIds.filter(Boolean)
  if (ids.length === 0) return {}
  const { rows } = await sql`
    SELECT id, scope, ref_id, file_name, content_type, size, created_at
    FROM task_attachments
    WHERE scope = 'client_task' AND client_id = ${clientId} AND ref_id = ANY(${ids as any}::text[])
    ORDER BY created_at ASC
  `
  return groupByRef(rows)
}
