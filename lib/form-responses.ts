// lib/form-responses.ts — what clients have answered, laid out against the
// form's own questions so a completed form can be read, printed or exported.
import { sql } from "@/lib/db"
import type { FormDefinition } from "@/lib/portal-forms"

export interface AnsweredField {
  label: string
  fieldKey: string
  type: string
  value: string
  answered: boolean
}

export interface AnsweredSection {
  title: string
  description: string | null
  fields: AnsweredField[]
}

export interface CompletedForm {
  clientId: string
  formKey: string
  label: string
  sections: AnsweredSection[]
  answered: number
  total: number
  updatedAt: string | null
}

// Turn a stored value into what a person reads: option labels instead of
// stored option keys, Yes/No instead of true/false.
export function displayValue(field: { type: string; options: { value: string; label: string }[] | null }, raw: string): string {
  const value = (raw ?? "").trim()
  if (!value) return ""
  if (field.type === "checkbox") return value === "true" ? "Yes" : "No"
  if (field.options) {
    const hit = field.options.find((o) => o.value === value)
    return hit ? hit.label : value
  }
  return value
}

export async function loadAnswers(clientId: string, formKey: string): Promise<{ values: Record<string, string>; updatedAt: string | null }> {
  const r = await sql`
    SELECT field_key, value, updated_at FROM form_responses
    WHERE client_id = ${String(clientId)} AND form_key = ${formKey}
  `
  const values: Record<string, string> = {}
  let updatedAt: string | null = null
  for (const row of r.rows) {
    values[String(row.field_key)] = row.value == null ? "" : String(row.value)
    const at = row.updated_at ? String(row.updated_at) : null
    if (at && (!updatedAt || at > updatedAt)) updatedAt = at
  }
  return { values, updatedAt }
}

export function buildCompletedForm(
  clientId: string,
  definition: FormDefinition,
  values: Record<string, string>,
  updatedAt: string | null
): CompletedForm {
  let answered = 0
  let total = 0
  const sections = definition.sections.map((section) => ({
    title: section.title,
    description: section.description,
    fields: section.fields.map((f) => {
      const raw = values[f.fieldKey] ?? ""
      const shown = displayValue(f, raw)
      total++
      // An unchecked checkbox is still an answer; an empty text box isn't.
      const isAnswered = f.type === "checkbox" ? raw !== "" : shown !== ""
      if (isAnswered) answered++
      return { label: f.label, fieldKey: f.fieldKey, type: f.type, value: shown, answered: isAnswered }
    }),
  }))
  return { clientId, formKey: definition.key, label: definition.label, sections, answered, total, updatedAt }
}

// Which clients have answered anything on this form.
export async function clientsWithAnswers(formKey: string): Promise<{ clientId: string; answers: number; updatedAt: string }[]> {
  const r = await sql`
    SELECT client_id, COUNT(*)::int AS answers, MAX(updated_at) AS updated_at
    FROM form_responses
    WHERE form_key = ${formKey} AND COALESCE(value, '') <> ''
    GROUP BY client_id
    ORDER BY MAX(updated_at) DESC
  `
  return r.rows.map((row) => ({
    clientId: String(row.client_id),
    answers: Number(row.answers),
    updatedAt: String(row.updated_at),
  }))
}

// CSV of one client's completed form — question per row, so it opens cleanly
// in Excel without any spreadsheet gymnastics.
export function toCsv(form: CompletedForm, clientLabel: string): string {
  const esc = (s: string) => `"${(s ?? "").replace(/"/g, '""')}"`
  const lines = [
    ["Form", "Client", "Section", "Question", "Answer"].map(esc).join(","),
  ]
  for (const section of form.sections) {
    for (const f of section.fields) {
      lines.push([form.label, clientLabel, section.title, f.label, f.value].map(esc).join(","))
    }
  }
  return lines.join("\r\n")
}
