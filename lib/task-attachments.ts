import { sql } from "./db"

export interface TaskAttachment {
  id: string
  scope: "template" | "client_task"
  ref_id: string
  file_name: string
  content_type: string | null
  size: number | null
  created_at: string
  /**
   * Only set on client_task rows: true when the firm put the file on the task
   * (a custom task's attachments), false when the client uploaded it. Decided
   * the same way Field Notes decides it, by looking the uploader up in
   * admin_users.
   */
  by_firm?: boolean
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
  // A custom task's own files are attached by the firm with this same scope, so
  // the uploader decides which list the file belongs in on the client's screen.
  const { rows } = await sql`
    SELECT ta.id, ta.scope, ta.ref_id, ta.file_name, ta.content_type, ta.size, ta.created_at,
           (au.email IS NOT NULL) AS by_firm
    FROM task_attachments ta
    LEFT JOIN admin_users au ON au.email = ta.uploaded_by
    WHERE ta.scope = 'client_task' AND ta.client_id = ${clientId}
      AND ta.ref_id = ANY(${ids as any}::text[])
    ORDER BY ta.created_at ASC
  `
  return groupByRef(rows)
}
