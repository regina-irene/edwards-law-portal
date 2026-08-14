// lib/portal-forms.ts — forms built in the portal's own form builder.
//
// The stored definition uses the SAME shape FileFlow returns, so the client
// filler (components/tasks/FormFill.tsx) renders a portal form and a FileFlow
// form identically, and answers land in the same form_responses table.
import { sql } from "@/lib/db"
import type { FormDefinition, FormField, FormSection, FormSummary } from "@/lib/fileflow"

export type { FormDefinition, FormField, FormSection, FormSummary }

// What the client filler can render — anything outside this list is coerced to
// a plain text box rather than silently rendering nothing.
export const FIELD_TYPES = [
  "text",
  "textarea",
  "email",
  "tel",
  "date",
  "number",
  "currency",
  "select",
  "radio",
  "checkbox",
] as const

export type FieldType = (typeof FIELD_TYPES)[number]

export function isFieldType(t: string): t is FieldType {
  return (FIELD_TYPES as readonly string[]).includes(t)
}

// Keys identify a form in a URL and on a task, and identify an answer in
// form_responses — so they have to be stable, unique and URL-safe.
export function slugify(input: string, fallback = "form"): string {
  const slug = (input || "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
  return slug || fallback
}

export interface PortalForm {
  key: string
  label: string
  description: string | null
  // The case stage this form belongs to; null = standalone.
  stage: string | null
  definition: FormDefinition
  source: string | null
  updated_at: string
}

export async function listPortalForms(): Promise<PortalForm[]> {
  const r = await sql`
    SELECT key, label, description, definition, source, stage, updated_at
    FROM portal_forms WHERE archived = FALSE ORDER BY label ASC
  `
  return r.rows.map(toPortalForm)
}

export async function getPortalForm(key: string): Promise<PortalForm | null> {
  const r = await sql`
    SELECT key, label, description, definition, source, stage, updated_at
    FROM portal_forms WHERE key = ${key} AND archived = FALSE LIMIT 1
  `
  return r.rows[0] ? toPortalForm(r.rows[0]) : null
}

function toPortalForm(row: Record<string, unknown>): PortalForm {
  const definition = row.definition as FormDefinition
  return {
    key: String(row.key),
    label: String(row.label),
    description: row.description ? String(row.description) : null,
    stage: row.stage ? String(row.stage) : null,
    definition,
    source: row.source ? String(row.source) : null,
    updated_at: String(row.updated_at),
  }
}

// The stages a form can be filed under: exactly the ones on the task board, so
// the two screens never drift. Stages Regina adds there appear here too.
export async function listStages(): Promise<string[]> {
  try {
    const r = await sql`
      SELECT stage, MIN(stage_order) AS ord FROM task_templates
      WHERE stage IS NOT NULL AND stage <> ''
      GROUP BY stage ORDER BY MIN(stage_order), stage
    `
    return r.rows.map((row) => String(row.stage))
  } catch {
    return []
  }
}

// A free key derived from the label: "Contact Information" → contact-information,
// then -2, -3… if taken.
export async function uniqueKey(label: string): Promise<string> {
  const base = slugify(label)
  const taken = await sql`SELECT key FROM portal_forms WHERE key LIKE ${base + "%"}`
  const used = new Set(taken.rows.map((r) => String(r.key)))
  if (!used.has(base)) return base
  for (let i = 2; i < 500; i++) {
    const candidate = `${base}-${i}`
    if (!used.has(candidate)) return candidate
  }
  return `${base}-${Date.now()}`
}

export async function savePortalForm(form: {
  key: string
  label: string
  description?: string | null
  definition: FormDefinition
  source?: string | null
  stage?: string | null
}): Promise<PortalForm> {
  const r = await sql`
    INSERT INTO portal_forms (key, label, description, definition, source, stage, updated_at)
    VALUES (${form.key}, ${form.label}, ${form.description ?? null}, ${JSON.stringify(form.definition)}, ${form.source ?? null}, ${form.stage ?? null}, NOW())
    ON CONFLICT (key) DO UPDATE SET
      label = EXCLUDED.label,
      description = EXCLUDED.description,
      definition = EXCLUDED.definition,
      stage = EXCLUDED.stage,
      archived = FALSE,
      updated_at = NOW()
    RETURNING key, label, description, definition, source, stage, updated_at
  `
  return toPortalForm(r.rows[0])
}

// Archive rather than delete: answers in form_responses reference the key, and
// a deleted form would orphan a client's saved work.
export async function archivePortalForm(key: string): Promise<boolean> {
  const r = await sql`UPDATE portal_forms SET archived = TRUE, updated_at = NOW() WHERE key = ${key} RETURNING key`
  return r.rows.length > 0
}

// Normalize whatever came out of the converter (or the editor) into a
// definition the filler can render: stable ids, unique field keys, known types.
export function normalizeDefinition(
  key: string,
  label: string,
  description: string | null,
  sections: {
    title?: string
    description?: string | null
    fields?: {
      label?: string
      fieldKey?: string
      type?: string
      placeholder?: string | null
      helpText?: string | null
      required?: boolean
      width?: string | null
      options?: { value?: string; label?: string }[] | null
    }[]
  }[]
): FormDefinition {
  const seen = new Set<string>()
  const out: FormSection[] = sections.map((section, si) => {
    const fields: FormField[] = (section.fields ?? []).map((f, fi) => {
      const type = f.type && isFieldType(f.type) ? f.type : "text"
      // An existing key is preserved EXACTLY — it's what a client's saved
      // answer is filed under (FileFlow's are underscored, e.g.
      // client_full_name), so re-slugifying it would orphan real answers.
      // Only a key we're inventing from a label gets slugified.
      const provided = (f.fieldKey ?? "").trim()
      let fieldKey = /^[A-Za-z0-9_-]+$/.test(provided)
        ? provided
        : slugify(provided || f.label || `field-${si}-${fi}`, `field-${si}-${fi}`)
      while (seen.has(fieldKey)) fieldKey = `${fieldKey}-${fi + 1}`
      seen.add(fieldKey)
      const options =
        (type === "select" || type === "radio") && Array.isArray(f.options) && f.options.length > 0
          ? f.options.map((o, oi) => ({
              value: slugify(o.value || o.label || `option-${oi}`, `option-${oi}`),
              label: (o.label || o.value || `Option ${oi + 1}`).trim(),
            }))
          : null
      return {
        id: `${key}-${si}-${fi}`,
        fieldKey,
        label: (f.label || "Untitled question").trim(),
        scope: "client",
        type,
        placeholder: f.placeholder?.trim() || null,
        helpText: f.helpText?.trim() || null,
        required: Boolean(f.required),
        width: f.width === "half" ? "half" : "full",
        options,
        position: fi,
      }
    })
    return {
      id: `${key}-section-${si}`,
      title: (section.title || "Questions").trim(),
      description: section.description?.trim() || null,
      position: si,
      fields,
    }
  })

  return { key, label, description, sections: out.filter((s) => s.fields.length > 0) }
}

export function countFields(def: FormDefinition): number {
  return def.sections.reduce((n, s) => n + s.fields.length, 0)
}
