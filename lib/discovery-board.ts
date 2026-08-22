// lib/discovery-board.ts - every client's Discovery table in one admin board,
// fully editable (2026-08-20).
//
// WHY THIS IS NOT lib/doc-board
// Pleadings and Correspondence are built by the Google Drive sync, so the board
// there can only safely touch the two columns the firm fills in by hand.
// Discovery is the opposite: the firm builds every row itself, links it to a
// Drive folder by hand, and the sync never touches it. So every column here is
// editable, including the one that matters most:
//
//   "Avail. to Client" is the gate. lib/discovery serves the client ONLY rows
//   with that box ticked, so unticking it takes a document off their Discovery
//   page. It is editable from the portal for exactly that reason, and it is the
//   one field on this board that changes what a client can see.
//
// The admin board reads EVERY row, ticked or not - you cannot manage a gate you
// cannot see the closed side of.
import { unstable_cache, revalidateTag } from "next/cache"
import { getAllClients, clientDisplayLabel } from "@/lib/airtable"

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY!

export const DISCOVERY_BOARD_CACHE_TAG = "discovery-board"

const TABLE = "Discovery"

/** Column names, with the spellings seen across bases. First is canonical. */
const FIELDS = {
  name: ["Name"],
  date: ["Date"],
  direction: ["Incoming or Outgoing"],
  tags: ["Tags"],
  notes: ["Notes", "Note"],
  url: ["URL", "Url", "Link"],
  // ONE spelling, deliberately. lib/discovery - the file that actually serves
  // the client's page - filters on this exact literal. Accepting aliases here
  // let the gate and its enforcement disagree in both directions: a base
  // spelled "Avail to Client" would have rows the page hides but the folder
  // endpoint treats as open, and a save through an alias would report "the
  // client can see this" while the client's page still hid it. If a base ever
  // genuinely uses a different name, change it in BOTH files or not at all.
  available: ["Avail. to Client"],
} as const

export type DiscoveryField = keyof typeof FIELDS

export interface DiscoveryChoice {
  name: string
  color?: string
}

export interface DiscoveryBoardRow {
  recordId: string
  baseId: string
  clientId: string
  clientLabel: string
  archived: boolean
  name: string
  date: string | null
  direction: string
  tags: string[]
  notes: string
  url: string
  /** The gate. True means this row is on the client's Discovery page. */
  available: boolean
  /** The exact column names this base uses, so a save lands on the right ones. */
  fieldNames: Record<DiscoveryField, string>
}

/** Options for the two select columns, per base. */
export interface DiscoveryChoices {
  direction: DiscoveryChoice[]
  tags: DiscoveryChoice[]
}

export type DiscoveryChoicesByBase = Record<string, DiscoveryChoices>

export interface DiscoveryBoard {
  rows: DiscoveryBoardRow[]
  choices: DiscoveryChoicesByBase
}

function text(v: unknown): string {
  return typeof v === "string" ? v.trim() : ""
}

function resolveKey(
  records: { fields: Record<string, unknown> }[],
  candidates: readonly string[]
): string {
  const seen = new Set<string>()
  for (const r of records) for (const k of Object.keys(r.fields)) seen.add(k)
  for (const c of candidates) if (seen.has(c)) return c
  return candidates[0]
}

function pick(f: Record<string, unknown>, candidates: readonly string[]): unknown {
  for (const c of candidates) if (f[c] !== undefined) return f[c]
  return undefined
}

async function fetchAll(baseId: string): Promise<{ id: string; fields: Record<string, unknown> }[]> {
  const records: { id: string; fields: Record<string, unknown> }[] = []
  let offset: string | undefined
  do {
    const url =
      `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(TABLE)}` +
      (offset ? `?offset=${encodeURIComponent(offset)}` : "")
    const res = await fetch(url, { headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}` } })
    // Not every client base has a Discovery table. That is normal, not an error.
    if (res.status === 404 || res.status === 403) return []
    if (!res.ok) throw new Error(`Airtable error: ${res.status}`)
    const data = await res.json()
    records.push(...(data.records ?? []))
    offset = data.offset
  } while (offset)
  return records
}

/**
 * Select options for Direction and Tags, from the base's own schema.
 *
 * Needs `schema.bases:read`. Returns null on any failure, and the caller falls
 * back to the values already stored on the records - see lib/doc-board for the
 * same pattern and the reasoning.
 */
async function fetchChoices(baseId: string): Promise<Partial<DiscoveryChoices> | null> {
  try {
    const res = await fetch(`https://api.airtable.com/v0/meta/bases/${baseId}/tables`, {
      headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}` },
    })
    if (!res.ok) return null
    const data = (await res.json()) as {
      tables?: {
        name?: string
        fields?: { name?: string; options?: { choices?: { name?: string; color?: string }[] } }[]
      }[]
    }
    const table = data.tables?.find((t) => t.name === TABLE)
    if (!table) return null
    const optionsFor = (candidates: readonly string[]): DiscoveryChoice[] => {
      const field = table.fields?.find((f) => typeof f.name === "string" && candidates.includes(f.name))
      const choices = field?.options?.choices
      if (!Array.isArray(choices)) return []
      return choices
        .map((c) => ({ name: String(c?.name ?? ""), color: c?.color }))
        .filter((c) => c.name.length > 0)
    }
    return { direction: optionsFor(FIELDS.direction), tags: optionsFor(FIELDS.tags) }
  } catch {
    return null
  }
}

async function pooled<T, R>(items: T[], size: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = []
  for (let i = 0; i < items.length; i += size) {
    out.push(...(await Promise.all(items.slice(i, i + size).map(fn))))
  }
  return out
}

async function loadBoard(): Promise<DiscoveryBoard> {
  const clients = (await getAllClients()).filter((c) => c.clientBaseId)

  const per = await pooled(clients, 5, async (c) => {
    const baseId = String(c.clientBaseId)
    const label = clientDisplayLabel(c.name) || c.name || c.email || String(c.clientId)
    let records: { id: string; fields: Record<string, unknown> }[] = []
    try {
      records = await fetchAll(baseId)
    } catch (e) {
      console.error(`[discovery-board] ${label} failed:`, e instanceof Error ? e.message : e)
      return { rows: [] as DiscoveryBoardRow[], baseId, choices: { direction: [], tags: [] } }
    }

    const fieldNames = Object.fromEntries(
      (Object.keys(FIELDS) as DiscoveryField[]).map((k) => [k, resolveKey(records, FIELDS[k])])
    ) as Record<DiscoveryField, string>

    const rows: DiscoveryBoardRow[] = records.map((r) => {
      const f = r.fields
      const rawTags = pick(f, FIELDS.tags)
      return {
        recordId: r.id,
        baseId,
        clientId: String(c.clientId),
        clientLabel: label,
        archived: c.archived,
        name: text(pick(f, FIELDS.name)).replace(/\s+/g, " "),
        date: text(pick(f, FIELDS.date)) || null,
        direction: text(pick(f, FIELDS.direction)),
        tags: (Array.isArray(rawTags) ? rawTags : []).map((t) => String(t)).filter(Boolean),
        notes: text(pick(f, FIELDS.notes)),
        url: text(pick(f, FIELDS.url)),
        // Airtable leaves an unticked checkbox out of the payload entirely, so
        // absent means false. Never the other way round: defaulting a missing
        // gate to "visible" would put documents in front of clients by accident.
        available: pick(f, FIELDS.available) === true,
        fieldNames,
      }
    })

    const schema = await fetchChoices(baseId)
    const observedDirection = new Map<string, DiscoveryChoice>()
    const observedTags = new Map<string, DiscoveryChoice>()
    for (const c2 of schema?.direction ?? []) observedDirection.set(c2.name, c2)
    for (const c2 of schema?.tags ?? []) observedTags.set(c2.name, c2)
    for (const r of rows) {
      if (r.direction && !observedDirection.has(r.direction)) {
        observedDirection.set(r.direction, { name: r.direction })
      }
      for (const t of r.tags) if (!observedTags.has(t)) observedTags.set(t, { name: t })
    }

    return {
      rows,
      baseId,
      choices: {
        direction: [...observedDirection.values()],
        tags: [...observedTags.values()].sort((a, b) => a.name.localeCompare(b.name)),
      },
    }
  })

  const rows = per.flatMap((p) => p.rows)
  rows.sort(
    (a, b) => a.clientLabel.localeCompare(b.clientLabel) || (b.date ?? "").localeCompare(a.date ?? "")
  )

  const choices: DiscoveryChoicesByBase = {}
  for (const p of per) choices[p.baseId] = p.choices

  return { rows, choices }
}

const cachedBoard: () => Promise<DiscoveryBoard> = unstable_cache(loadBoard, ["discovery-board-all"], {
  revalidate: 300,
  tags: [DISCOVERY_BOARD_CACHE_TAG],
})

/** Throws on a failed read so the page shows an error, never a false "empty". */
export async function buildDiscoveryBoard(
  options: { includeArchived?: boolean } = {}
): Promise<DiscoveryBoard> {
  const board = await cachedBoard()
  return {
    rows: options.includeArchived === true ? board.rows : board.rows.filter((r) => !r.archived),
    choices: board.choices,
  }
}

export function revalidateDiscoveryBoard(): void {
  revalidateTag(DISCOVERY_BOARD_CACHE_TAG, { expire: 0 })
}

export interface DiscoveryPatch {
  name?: string
  date?: string | null
  direction?: string
  tags?: string[]
  notes?: string
  url?: string
  available?: boolean
}

/**
 * Write to one Discovery row in a client's own base.
 *
 * Only the keys present are sent, so saving a note cannot blank the link and
 * ticking the gate cannot blank the tags.
 */
export async function updateDiscoveryRecord(
  baseId: string,
  recordId: string,
  patch: DiscoveryPatch,
  fieldNames: Record<DiscoveryField, string>
): Promise<void> {
  const fields: Record<string, unknown> = {}
  if (patch.name !== undefined) fields[fieldNames.name] = patch.name
  if (patch.date !== undefined) fields[fieldNames.date] = patch.date || null
  if (patch.direction !== undefined) fields[fieldNames.direction] = patch.direction || null
  if (patch.tags !== undefined) fields[fieldNames.tags] = patch.tags
  if (patch.notes !== undefined) fields[fieldNames.notes] = patch.notes
  if (patch.url !== undefined) fields[fieldNames.url] = patch.url
  if (patch.available !== undefined) fields[fieldNames.available] = patch.available
  if (Object.keys(fields).length === 0) return

  const res = await fetch(
    `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(TABLE)}/${encodeURIComponent(recordId)}`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${AIRTABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ fields }),
    }
  )
  if (!res.ok) {
    const detail = await res.text().catch(() => "")
    throw new Error(`Airtable save failed: ${res.status}${detail ? ` ${detail.slice(0, 300)}` : ""}`)
  }
  revalidateDiscoveryBoard()
}

/** The URL on one Discovery row, used to authorise a folder expansion. */
export async function discoveryRecordUrl(baseId: string, recordId: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(TABLE)}/${encodeURIComponent(recordId)}`,
      { headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}` } }
    )
    if (!res.ok) return null
    const data = (await res.json()) as { fields?: Record<string, unknown> }
    return text(pick(data.fields ?? {}, FIELDS.url)) || null
  } catch {
    return null
  }
}

/** Whether one Discovery row is gated open to the client. */
export async function discoveryRecordAvailable(baseId: string, recordId: string): Promise<boolean> {
  try {
    const res = await fetch(
      `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(TABLE)}/${encodeURIComponent(recordId)}`,
      { headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}` } }
    )
    if (!res.ok) return false
    const data = (await res.json()) as { fields?: Record<string, unknown> }
    return pick(data.fields ?? {}, FIELDS.available) === true
  } catch {
    return false
  }
}
