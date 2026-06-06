// Read-only access to the FileFlow app's intake form definitions (separate Neon
// database). We only READ form designs here; answers are stored in this portal.
import { Pool } from "pg"

let pool: Pool | null = null
function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.FILEFLOW_DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: 3,
    })
  }
  return pool
}

export interface FormField {
  id: string
  fieldKey: string
  label: string
  scope: string
  type: string
  placeholder: string | null
  helpText: string | null
  required: boolean
  width: string | null
  options: { value: string; label: string }[] | null
  position: number
}

export interface FormSection {
  id: string
  title: string
  description: string | null
  position: number
  fields: FormField[]
}

export interface FormDefinition {
  key: string
  label: string
  description: string | null
  sections: FormSection[]
}

export interface FormSummary {
  key: string
  label: string
  description: string | null
}

export async function listForms(): Promise<FormSummary[]> {
  const { rows } = await getPool().query(
    `SELECT key, label, description FROM "IntakeForm" WHERE archived = false ORDER BY position ASC`
  )
  return rows
}

export async function getForm(key: string): Promise<FormDefinition | null> {
  const pool = getPool()
  const f = await pool.query(
    `SELECT id, key, label, description FROM "IntakeForm" WHERE key = $1 AND archived = false LIMIT 1`,
    [key]
  )
  if (f.rows.length === 0) return null
  const form = f.rows[0]

  const sectionsRes = await pool.query(
    `SELECT id, title, description, position FROM "IntakeSection" WHERE "formId" = $1 ORDER BY position ASC`,
    [form.id]
  )
  const sectionIds = sectionsRes.rows.map((s) => s.id)
  let fieldsRes = { rows: [] as any[] }
  if (sectionIds.length > 0) {
    fieldsRes = await pool.query(
      `SELECT id, "sectionId", "fieldKey", label, scope, type, placeholder, "helpText", required, width, options, position
       FROM "IntakeField" WHERE "sectionId" = ANY($1::text[]) ORDER BY position ASC`,
      [sectionIds]
    )
  }
  const fieldsBySection: Record<string, FormField[]> = {}
  for (const row of fieldsRes.rows) {
    ;(fieldsBySection[row.sectionId] ??= []).push({
      id: row.id,
      fieldKey: row.fieldKey,
      label: row.label,
      scope: row.scope,
      type: row.type,
      placeholder: row.placeholder,
      helpText: row.helpText,
      required: row.required,
      width: row.width,
      options: row.options ?? null,
      position: row.position,
    })
  }

  return {
    key: form.key,
    label: form.label,
    description: form.description,
    sections: sectionsRes.rows.map((s) => ({
      id: s.id,
      title: s.title,
      description: s.description,
      position: s.position,
      fields: fieldsBySection[s.id] ?? [],
    })),
  }
}
