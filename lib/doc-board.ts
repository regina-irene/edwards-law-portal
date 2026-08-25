// lib/doc-board.ts - every client's Pleadings and Correspondence in one admin
// board, with the columns the firm fills in by hand made editable (2026-08-20).
//
// WHAT IS EDITABLE AND WHY IT IS ONLY THIS
// These tables live in each CLIENT's own Airtable base and their rows are
// created by the Google Drive sync. The sync owns the file itself:
//
//   owned by Drive   File Path / Name of File, Link, Created, Parent Folder,
//                    File Type. Editing any of these is pointless at best -
//                    the next sync writes over it - and at worst detaches a
//                    row from its document.
//   filled in by you Notes, and "Filed by:" (Pleadings) / "Sent by:"
//                    (Correspondence). The sync never touches these, so an edit
//                    here sticks.
//
// So this module reads everything and writes back exactly two fields. Anything
// else is deliberately not offered.
//
// FIELD NAMES VARY BETWEEN BASES
// Client bases were set up at different times: the person column is variously
// "Filed by:", "Filed by" or "Filed By". Reading is tolerant of all of them.
// WRITING cannot be: sending "Filed by:" to a base whose column is "Filed By"
// makes Airtable reject the request, or worse, silently create a new column. So
// the actual key in use is worked out from the records as they are read, and
// carried on the row all the way to the save.
import { unstable_cache, revalidateTag } from "next/cache"
import { getAllClients, clientDisplayLabel } from "@/lib/airtable"
import { parsePleadingName } from "@/lib/pleadings"

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY!

export const DOC_BOARD_CACHE_TAG = "doc-board"

export type DocKind = "pleadings" | "correspondence"

/** The Airtable table behind each kind, and the person column it uses. */
const TABLE: Record<DocKind, string> = {
  pleadings: "Pleadings",
  correspondence: "Correspondence",
}

/** Every spelling of the person column seen across the bases, best first. */
const PERSON_KEYS: Record<DocKind, string[]> = {
  pleadings: ["Filed by:", "Filed by", "Filed By"],
  correspondence: ["Sent by:", "Sent By", "Sent by"],
}

const NOTES_KEYS = ["Notes", "Note"]

export interface DocBoardRow {
  /** Airtable record id inside the client's own base. */
  recordId: string
  /** The client's base, needed to write back. */
  baseId: string
  clientId: string
  clientLabel: string
  archived: boolean
  kind: DocKind
  title: string
  /** Date parsed from the file name, else null. Never the Drive sync time. */
  date: string | null
  created: string | null
  folder: string | null
  fileType: string
  link: string
  /** EDITABLE. "Filed by" / "Sent by". */
  person: string
  /** EDITABLE. */
  notes: string
  /** The exact Airtable column names to write back to, for this record's base. */
  personField: string
  notesField: string
}

function text(v: unknown): string {
  return typeof v === "string" ? v.trim() : ""
}

/**
 * The column name a base actually uses, chosen from the keys present across its
 * records. Airtable omits empty fields per record, so this looks at all of them
 * and falls back to the canonical spelling when the column is empty everywhere.
 */
function resolveKey(records: { fields: Record<string, unknown> }[], candidates: string[]): string {
  const seen = new Set<string>()
  for (const r of records) for (const k of Object.keys(r.fields)) seen.add(k)
  for (const c of candidates) if (seen.has(c)) return c
  return candidates[0]
}

/**
 * The single select options a base actually defines, per table.
 *
 * Read from the Meta API, which needs the `schema.bases:read` scope. That scope
 * is not guaranteed on the portal's token, and the call is per base, so this
 * returns null on ANY failure and the caller falls back to the values it can
 * see in the records. Never throws: a base whose schema is unreadable must
 * still appear on the board.
 *
 * Worth the call when it works, because it includes options that exist on the
 * board but have never been used on a document - which the records alone can
 * never reveal.
 */
async function fetchSelectOptions(baseId: string): Promise<Partial<Record<DocKind, DocChoice[]>> | null> {
  try {
    const res = await fetch(`https://api.airtable.com/v0/meta/bases/${baseId}/tables`, {
      headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}` },
    })
    if (!res.ok) return null
    const data = (await res.json()) as {
      tables?: {
        name?: string
        fields?: {
          name?: string
          type?: string
          options?: { choices?: { name?: string; color?: string }[] }
        }[]
      }[]
    }
    const out: Partial<Record<DocKind, DocChoice[]>> = {}
    for (const kind of ["pleadings", "correspondence"] as DocKind[]) {
      const table = data.tables?.find((t) => t.name === TABLE[kind])
      if (!table) continue
      const field = table.fields?.find(
        (f) => typeof f.name === "string" && PERSON_KEYS[kind].includes(f.name)
      )
      const choices = field?.options?.choices
      if (!Array.isArray(choices)) continue
      // Names are kept EXACTLY as defined, trailing spaces and all: the value
      // written back has to match the option character for character. The
      // colour is carried too, so a chip shows what the board shows instead of
      // being guessed from the option's wording.
      out[kind] = choices
        .map((c) => ({ name: String(c?.name ?? ""), color: c?.color }))
        .filter((c) => c.name.length > 0)
    }
    return out
  } catch {
    return null
  }
}

async function fetchTable(
  baseId: string,
  table: string
): Promise<{ id: string; fields: Record<string, unknown> }[]> {
  const records: { id: string; fields: Record<string, unknown> }[] = []
  let offset: string | undefined
  do {
    const url =
      `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(table)}` +
      (offset ? `?offset=${encodeURIComponent(offset)}` : "")
    const res = await fetch(url, { headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}` } })
    // A base with no such table is normal, not an error: not every client has
    // Correspondence set up. Anything else is worth knowing about.
    if (res.status === 404 || res.status === 403) return []
    if (!res.ok) throw new Error(`Airtable error: ${res.status}`)
    const data = await res.json()
    records.push(...(data.records ?? []))
    offset = data.offset
  } while (offset)
  return records
}


/**
 * The value that carries the file's FOLDER PATH, from whichever column holds it.
 *
 * Client bases disagree about which column that is. Some put the full path in
 * "File Path" ("Divorce/2024.01.09 Answer.pdf") while also having a "Name"
 * column holding just the bare filename; others only have one of the two.
 *
 * So the candidates are searched for one that actually contains a slash rather
 * than trusting a fixed order. Preferring "Name" cost Gichana its folder
 * colours: every row looked path-less, so the "which folder is the table's own
 * root" test decided BOTH Divorce and Contempt were the root and threw both
 * away, leaving every filing untagged and untinted. (2026-08-22)
 */
function pathBearing(values: string[]): string {
  return values.find((v) => v && /[/\\]/.test(v)) ?? values.find(Boolean) ?? ""
}

function rowsFor(
  kind: DocKind,
  baseId: string,
  clientId: string,
  clientLabel: string,
  archived: boolean,
  records: { id: string; fields: Record<string, unknown> }[]
): DocBoardRow[] {
  const personField = resolveKey(records, PERSON_KEYS[kind])
  const notesField = resolveKey(records, NOTES_KEYS)

  const rawNameOf = (f: Record<string, unknown>) =>
    pathBearing([text(f["File Path"]), text(f["Name of File"]), text(f["Name"])])

  // Which folder is the table's own? Whatever the files carrying no folder path
  // sit in. Same rule as lib/pleadings, so the two lists agree.
  const rootFolders = new Set(
    records
      .filter((r) => !/[/\\]/.test(rawNameOf(r.fields)))
      .map((r) => text(r.fields["Parent Folder"]).toLowerCase())
      .filter(Boolean)
  )

  return records
    .map((r): DocBoardRow => {
      const f = r.fields
      const rawName = rawNameOf(f)
      const { title, filedOn, folder } = parsePleadingName(rawName)
      const parentFolder = text(f["Parent Folder"])
      const fileType =
        text(typeof f["File Type"] === "string" ? f["File Type"] : "") ||
        (rawName.match(/\.(\w{2,4})$/)?.[1] ?? "")
      return {
        recordId: r.id,
        baseId,
        clientId,
        clientLabel,
        archived,
        kind,
        title,
        date: filedOn,
        created: text(f["Created"]) || null,
        folder:
          folder ??
          (parentFolder && !rootFolders.has(parentFolder.toLowerCase()) ? parentFolder : null),
        fileType,
        link: text(f["Link"]),
        person: PERSON_KEYS[kind].map((k) => text(f[k])).find(Boolean) ?? "",
        notes: NOTES_KEYS.map((k) => text(f[k])).find(Boolean) ?? "",
        personField,
        notesField,
      }
    })
    // The subfolder itself syncs in as a row - it is not a document.
    .filter((d) => d.title && d.fileType.toLowerCase() !== "folder")
}

/** Run promises a few at a time. Forty clients at once trips Airtable's rate limit. */
async function pooled<T, R>(items: T[], size: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = []
  for (let i = 0; i < items.length; i += size) {
    out.push(...(await Promise.all(items.slice(i, i + size).map(fn))))
  }
  return out
}

/**
 * The choices offered for "Filed by" / "Sent by", PER BASE.
 *
 * Deliberately not pooled across clients. Each client base defines its own
 * select options, so offering one base's list on another client's document
 * invites a save Airtable will refuse - and a confusing error for something
 * that looked like a valid pick.
 */
/**
 * One option on a base's "Filed by:" / "Sent by:" column.
 *
 * `color` is the Airtable colour name from that base's schema ("cyanLight1").
 * Undefined when the schema could not be read, in which case the caller falls
 * back to guessing from the wording. That guess is genuinely unreliable: one
 * base pairs "Defendant" with "Wife" and another pairs it with "Husband", so a
 * keyword rule gets one of them backwards.
 */
export interface DocChoice {
  name: string
  color?: string
}

export type DocChoices = Record<string, Partial<Record<DocKind, DocChoice[]>>>

export interface DocBoard {
  rows: DocBoardRow[]
  choices: DocChoices
}

async function loadBoard(): Promise<DocBoard> {
  const clients = await getAllClients()
  const withBase = clients.filter((c) => c.clientBaseId)

  const perClient = await pooled(withBase, 5, async (c) => {
    const label = clientDisplayLabel(c.name) || c.name || c.email || String(c.clientId)
    const baseId = String(c.clientBaseId)
    const rows: DocBoardRow[] = []
    const observed: Record<DocKind, Set<string>> = {
      pleadings: new Set<string>(),
      correspondence: new Set<string>(),
    }

    for (const kind of ["pleadings", "correspondence"] as DocKind[]) {
      try {
        const records = await fetchTable(baseId, TABLE[kind])
        const built = rowsFor(kind, baseId, String(c.clientId), label, c.archived, records)
        rows.push(...built)
        for (const r of built) if (r.person) observed[kind].add(r.person)
      } catch (e) {
        // One unreachable base must not cost the whole board. The client simply
        // shows no rows for that table.
        console.error(`[doc-board] ${label} ${kind} failed:`, e instanceof Error ? e.message : e)
      }
    }

    // Schema first (it knows the colours, and options nobody has used yet), then
    // anything seen in the records that the schema did not mention - a base whose
    // column is plain text rather than a select has no schema choices at all.
    const schema = await fetchSelectOptions(baseId)
    const choices: Partial<Record<DocKind, DocChoice[]>> = {}
    for (const kind of ["pleadings", "correspondence"] as DocKind[]) {
      const merged = new Map<string, DocChoice>()
      for (const c of schema?.[kind] ?? []) merged.set(c.name, c)
      // A stored value the schema did not list gets no colour, so the UI falls
      // back to its keyword guess for that one rather than showing it blank.
      for (const v of observed[kind]) if (!merged.has(v)) merged.set(v, { name: v })
      if (merged.size > 0) {
        choices[kind] = [...merged.values()].sort((a, b) => a.name.localeCompare(b.name))
      }
    }

    return { rows, baseId, choices }
  })

  const all = perClient.flatMap((p) => p.rows)
  all.sort(
    (a, b) =>
      a.clientLabel.localeCompare(b.clientLabel) ||
      (b.date ?? b.created ?? "").localeCompare(a.date ?? a.created ?? "")
  )

  const choices: DocChoices = {}
  for (const p of perClient) choices[p.baseId] = p.choices

  return { rows: all, choices }
}

const cachedBoard: () => Promise<DocBoard> = unstable_cache(loadBoard, ["doc-board-all"], {
  revalidate: 300,
  tags: [DOC_BOARD_CACHE_TAG],
})

/**
 * Every document across every client.
 *
 * Deliberately NOT fail-soft: it throws so the page can say "couldn't load"
 * rather than showing an empty board that looks like "you have no filings".
 */
export async function buildDocBoard(options: { includeArchived?: boolean } = {}): Promise<DocBoard> {
  const board = await cachedBoard()
  return {
    rows: options.includeArchived === true ? board.rows : board.rows.filter((r) => !r.archived),
    choices: board.choices,
  }
}

export function revalidateDocBoard(): void {
  revalidateTag(DOC_BOARD_CACHE_TAG, { expire: 0 })
}

/**
 * Write the two hand-filled columns back to the client's own base.
 *
 * `personField` and `notesField` come from the row that was read, so the write
 * always lands on the column that base actually has. Only keys present in the
 * patch are sent, so saving a note can never blank the person.
 */
export async function updateDocFields(
  baseId: string,
  kind: DocKind,
  recordId: string,
  patch: { person?: string; notes?: string },
  fieldNames: { personField: string; notesField: string }
): Promise<void> {
  const fields: Record<string, unknown> = {}
  if (patch.person !== undefined) fields[fieldNames.personField] = patch.person
  if (patch.notes !== undefined) fields[fieldNames.notesField] = patch.notes
  if (Object.keys(fields).length === 0) return

  const res = await fetch(
    `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(TABLE[kind])}/${encodeURIComponent(recordId)}`,
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
  revalidateDocBoard()
}
