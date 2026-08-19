// lib/status-extra.ts — reads and renders the EXTRA Status-board fields a
// client has been allowed to see (see lib/status-fields.ts for the allow-list).
//
// The board is internal, so its values are all shapes: text, checkboxes,
// dates, multi-selects, linked-record arrays, collaborator objects, formula
// results. Anything this file doesn't positively recognise is dropped rather
// than guessed at — a client should never be shown "[object Object]", and a
// field the portal can't describe is better left off the page entirely.
import { longDate, fullStamp } from "@/lib/dates"
import { STATUS_TABLE_ID } from "@/lib/status-fields"

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY!
const MAIN_BASE_ID = process.env.AIRTABLE_MAIN_BASE_ID!

/** What the card should draw for one field. */
export type ExtraFieldDisplay =
  | { kind: "text"; text: string }
  | { kind: "chips"; values: string[] }

export interface ExtraField {
  name: string
  display: ExtraFieldDisplay
}

// "2026-03-03"
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/
// "2026-03-03T14:30:00.000Z" / "...+05:00"
const DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/

function isRealDate(iso: string): boolean {
  return !Number.isNaN(new Date(iso).getTime())
}

/**
 * An unknown Airtable value → something safe to put on a client's screen, or
 * null to skip the field entirely.
 *
 * Date-only strings are anchored to midday UTC before formatting: lib/dates
 * pins everything to America/New_York, and a bare "2026-03-03" is midnight UTC,
 * which in New York is the evening of the 2nd. Midday can't slip either way.
 */
export function renderFieldValue(value: unknown): ExtraFieldDisplay | null {
  if (value === null || value === undefined) return null

  if (typeof value === "boolean") return { kind: "text", text: value ? "Yes" : "No" }

  if (typeof value === "number") {
    return Number.isFinite(value) ? { kind: "text", text: String(value) } : null
  }

  if (typeof value === "string") {
    const text = value.trim()
    if (!text) return null
    if (DATE_ONLY.test(text) && isRealDate(`${text}T12:00:00Z`)) {
      return { kind: "text", text: longDate(`${text}T12:00:00Z`) }
    }
    if (DATE_TIME.test(text) && isRealDate(text)) {
      return { kind: "text", text: fullStamp(text) }
    }
    return { kind: "text", text }
  }

  if (Array.isArray(value)) {
    const values: string[] = []
    for (const item of value) {
      if (typeof item === "string") {
        const text = item.trim()
        if (text) values.push(text)
      } else if (typeof item === "number" && Number.isFinite(item)) {
        values.push(String(item))
      } else if (item && typeof item === "object" && !Array.isArray(item)) {
        // Linked records and collaborators carry a `name`. Attachments carry a
        // url and a filename instead — those are skipped on purpose, so a
        // file on the internal board can't leak out through this list.
        const name = (item as { name?: unknown }).name
        if (typeof name === "string" && name.trim()) values.push(name.trim())
      }
    }
    return values.length > 0 ? { kind: "chips", values } : null
  }

  // Plain objects: barcodes, buttons, formula error wrappers. Nothing worth
  // rendering, and every one of them stringifies to "[object Object]".
  return null
}

/**
 * The requested fields of one Status record, in the order asked for, with the
 * empty ones dropped.
 *
 * Same URL and same fetch options as getCaseStatus() in lib/airtable, so within
 * a single render Next serves both from one Airtable call rather than two.
 */
export async function getExtraFieldValues(
  recordId: string,
  fieldNames: string[]
): Promise<{ name: string; value: unknown }[]> {
  const id = String(recordId).split(",")[0].trim()
  if (!id.startsWith("rec") || fieldNames.length === 0) return []
  try {
    const res = await fetch(
      `https://api.airtable.com/v0/${MAIN_BASE_ID}/${STATUS_TABLE_ID}/${id}`,
      {
        headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}` },
        next: { revalidate: 60, tags: ["case-status"] },
      }
    )
    if (!res.ok) throw new Error(`Airtable error: ${res.status}`)
    const data = (await res.json()) as { fields?: Record<string, unknown> }
    const fields = data.fields ?? {}
    const out: { name: string; value: unknown }[] = []
    for (const name of fieldNames) {
      const value = fields[name]
      if (value === null || value === undefined) continue
      if (typeof value === "string" && !value.trim()) continue
      if (Array.isArray(value) && value.length === 0) continue
      out.push({ name, value })
    }
    return out
  } catch {
    // Fail soft: the card just doesn't get its extra section.
    return []
  }
}

/** getExtraFieldValues + renderFieldValue, ready to hand to the card. */
export async function getExtraFields(
  recordId: string,
  fieldNames: string[]
): Promise<ExtraField[]> {
  const raw = await getExtraFieldValues(recordId, fieldNames)
  const out: ExtraField[] = []
  for (const { name, value } of raw) {
    const display = renderFieldValue(value)
    if (display) out.push({ name, display })
  }
  return out
}
