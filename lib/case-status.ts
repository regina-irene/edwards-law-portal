// lib/case-status.ts — the Status board (Airtable tbl3gCA0CQ0S6ewW6) as data:
// plain-English names for every Case Stage, a paginated read of the whole
// board, and the one write path the admin Status page uses.
//
// The Case Stage option names on the board are internal shorthand ("4 - Post
// Answer Dis.", "3 - Served / wtg answer"). They are kept EXACTLY as-is
// everywhere so Airtable can still match them to its own colors and so a save
// never rewrites an option name; STAGE_PLAIN is the translation layer that
// decides what a human actually reads.
import { unstable_cache, revalidateTag } from "next/cache"
import { getAllClients, clientDisplayLabel } from "@/lib/airtable"

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY!
const MAIN_BASE_ID = process.env.AIRTABLE_MAIN_BASE_ID!

// The Status table, by id, so renaming it on the board is safe.
const STATUS_TABLE_ID = "tbl3gCA0CQ0S6ewW6"

export const CASE_STATUS_CACHE_TAG = "case-status"

// Only what the board needs. Payment Status and Judge are deliberately NOT
// read here — this data feeds a client-facing status, and the less of the
// internal record travels, the less can leak.
const STATUS_FIELDS = [
  "Case Stage",
  "Case Status - Dashboard",
  "Case Type",
  "County",
  "Last Modified",
] as const

// ---------------------------------------------------------------------------
// Stage vocabulary
// ---------------------------------------------------------------------------

// Every Case Stage choice on the board, verbatim. Used to validate a save so a
// typo can never write a brand-new option into Regina's live base.
// NOTE: "0 - Pre  Litigation" has a DOUBLE space. That is how it is stored.
export const CASE_STAGE_CHOICES: readonly string[] = [
  "0 - Pre  Litigation",
  "1 - Uncontested",
  "2 - Filed / Awaiting Service",
  "3 - Served / wtg answer",
  "4 - GAL Investigation",
  "4 - Post Answer Dis.",
  "4 - Special Master Investigation",
  "5 - Ready for Mediation",
  "6 - Mediation Scheduled",
  "6 - Settlement Negotiations",
  "7 - Awtg Final Trial",
  "7 - Final Trial sched.",
  "8 - Awtg Final Docs from Ct",
  "Cmpletd",
  "Completed",
  "On Hold",
  "WDing from Case",
  "N/A",
  "Unfiled",
]

// Plain English for a stressed non-lawyer. No abbreviations, no Latin, no
// court-speak, and nothing that promises an outcome or a date.
export const STAGE_PLAIN: Record<string, string> = {
  "0 - Pre  Litigation": "Getting your case ready before anything is filed",
  "1 - Uncontested": "Both sides agree, so no court fight is expected",
  "2 - Filed / Awaiting Service": "Filed with the court, waiting to notify the other party",
  "3 - Served / wtg answer": "The other party has been notified and has time to respond",
  "4 - GAL Investigation": "A guardian appointed by the court is looking into what is best for the children",
  "4 - Post Answer Dis.": "Gathering information from both sides",
  "4 - Special Master Investigation": "A neutral person appointed by the court is reviewing the disputed issues",
  "5 - Ready for Mediation": "Ready to meet with a neutral person to try to settle",
  "6 - Mediation Scheduled": "Your settlement meeting is on the calendar",
  "6 - Settlement Negotiations": "Working out an agreement with the other side",
  "7 - Awtg Final Trial": "Waiting for the court to set a final trial date",
  "7 - Final Trial sched.": "Your final trial date is set",
  "8 - Awtg Final Docs from Ct": "Waiting on final paperwork from the court",
  "Cmpletd": "Case complete",
  "Completed": "Case complete",
  "On Hold": "Paused for now",
  "WDing from Case": "Our firm is stepping away from this case",
  "N/A": "Not applicable",
  "Unfiled": "Nothing filed with the court yet",
}

// Second index keyed on collapsed whitespace, so the double space in
// "0 - Pre  Litigation" (or a stray one anywhere else) still finds its label.
const STAGE_PLAIN_LOOSE: Record<string, string> = (() => {
  const loose: Record<string, string> = {}
  for (const [raw, plain] of Object.entries(STAGE_PLAIN)) {
    loose[raw.replace(/\s+/g, " ").trim().toLowerCase()] = plain
  }
  return loose
})()

/**
 * Plain-English label for a raw Case Stage value. Falls back to the raw string
 * (and then to an empty-safe dash) so a pill is never blank and this never
 * throws, whatever new option someone adds on the board.
 */
export function plainStage(raw: string): string {
  const value = typeof raw === "string" ? raw.trim() : ""
  if (!value) return "—"
  const exact = STAGE_PLAIN[value]
  if (exact) return exact
  const loose = STAGE_PLAIN_LOOSE[value.replace(/\s+/g, " ").toLowerCase()]
  if (loose) return loose
  return value
}

/**
 * Sort key from the stage's leading digit. Stages with no number (Completed,
 * On Hold, N/A, Unfiled, WDing from Case) sort after every numbered stage.
 */
export function stageOrder(raw: string): number {
  const match = /^\s*(\d+)/.exec(typeof raw === "string" ? raw : "")
  return match ? Number(match[1]) : 99
}

/** Whole days between an ISO date/datetime and now. Null on missing or unparseable input. */
export function daysSince(iso: string | null): number | null {
  if (!iso) return null
  const then = new Date(iso).getTime()
  if (!Number.isFinite(then)) return null
  const days = Math.floor((Date.now() - then) / 86_400_000)
  return days < 0 ? 0 : days
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export interface CaseStatusRow {
  recordId: string
  stages: string[]
  statusText: string
  caseTypes: string[]
  county: string
  lastModified: string | null
}

// Airtable records are untyped JSON; `any` here matches lib/airtable.ts.
function mapStatusRecord(r: any): CaseStatusRow {
  const f = r?.fields ?? {}
  const selectList = (v: unknown): string[] =>
    (Array.isArray(v) ? v : []).map((s: unknown) => String(s).trim()).filter(Boolean)
  const text = (v: unknown): string => (typeof v === "string" ? v.trim() : "")
  return {
    recordId: String(r?.id ?? ""),
    stages: selectList(f["Case Stage"]),
    statusText: text(f["Case Status - Dashboard"]),
    caseTypes: selectList(f["Case Type"]),
    county: text(f["County"]),
    lastModified: typeof f["Last Modified"] === "string" && f["Last Modified"] ? f["Last Modified"] : null,
  }
}

// Airtable returns 100 records a page and hands back an `offset` while there
// are more. The loop is capped so a bad response can never spin forever.
const MAX_PAGES = 50

async function loadAllCaseStatuses(): Promise<CaseStatusRow[]> {
  const rows: CaseStatusRow[] = []
  let offset: string | undefined
  for (let page = 0; page < MAX_PAGES; page++) {
    const params = new URLSearchParams()
    params.set("pageSize", "100")
    for (const field of STATUS_FIELDS) params.append("fields[]", field)
    if (offset) params.set("offset", offset)
    // No fetch-level cache option: unstable_cache does the caching, and setting
    // one inside it makes Next log an "ignored fetch cache" warning per miss.
    const res = await fetch(
      `https://api.airtable.com/v0/${MAIN_BASE_ID}/${STATUS_TABLE_ID}?${params.toString()}`,
      { headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}` } }
    )
    if (!res.ok) throw new Error(`Airtable error: ${res.status}`)
    const data = await res.json()
    for (const record of data?.records ?? []) rows.push(mapStatusRecord(record))
    offset = typeof data?.offset === "string" && data.offset ? data.offset : undefined
    if (!offset) break
  }
  return rows
}

const cachedCaseStatuses: () => Promise<CaseStatusRow[]> = unstable_cache(
  loadAllCaseStatuses,
  ["airtable-all-case-status"],
  { revalidate: 60, tags: [CASE_STATUS_CACHE_TAG] }
)

/**
 * Every row on the Status board. Cached 60s under the "case-status" tag; a
 * successful save busts the tag. Fails soft to [] — the caller shows its own
 * "couldn't load" message rather than a crash.
 */
export async function listAllCaseStatuses(): Promise<CaseStatusRow[]> {
  try {
    // The try/catch lives OUTSIDE unstable_cache on purpose: a failed read must
    // not be cached as an empty board for the next 60 seconds.
    return await cachedCaseStatuses()
  } catch {
    return []
  }
}

// ---------------------------------------------------------------------------
// The joined board (clients + their Status row)
// ---------------------------------------------------------------------------

export interface CaseStatusBoardRow {
  recordId: string
  clientId: string
  name: string
  email: string
  stages: string[]
  plainStages: string[]
  statusText: string
  caseTypes: string[]
  county: string
  lastModified: string | null
  daysSinceUpdate: number | null
  /** false when this client has no row on the Status board at all. */
  hasStatusRecord: boolean
}

// The portal's clientId is the Status record id ("Client ID" on Clients is a
// record link, so String() of it yields "rec…", occasionally comma-joined).
function statusRecordId(clientId: string): string {
  const first = String(clientId ?? "").split(",")[0].trim()
  return first.startsWith("rec") ? first : ""
}

/**
 * Clients joined to their Status row. Clients with no Status record are still
 * returned (empty stages, hasStatusRecord false) so nobody silently vanishes
 * from the board.
 */
export async function buildStatusBoard(): Promise<CaseStatusBoardRow[]> {
  // Deliberately NOT fail-soft. If either read fails, this THROWS so the page
  // and the API route show "couldn't load". Swallowing the error produced a
  // board where every case read "no stage set", and saving such a row sent
  // `Case Stage: []` to Airtable — silently wiping the real stages off the
  // live board. A visible error is always better than a plausible blank one.
  const [clients, statuses] = await Promise.all([
    getAllClients(),
    cachedCaseStatuses(),
  ])
  const byRecordId = new Map<string, CaseStatusRow>()
  for (const s of statuses) if (s.recordId) byRecordId.set(s.recordId, s)

  const rows: CaseStatusBoardRow[] = []
  for (const c of clients) {
    const recordId = statusRecordId(c.clientId)
    if (!recordId) continue
    const status = byRecordId.get(recordId)
    const stages = status?.stages ?? []
    const lastModified = status?.lastModified ?? null
    rows.push({
      recordId,
      clientId: String(c.clientId),
      name: clientDisplayLabel(c.name) || c.name || c.email || recordId,
      email: c.email,
      stages,
      plainStages: stages.map(plainStage),
      statusText: status?.statusText ?? "",
      caseTypes: status?.caseTypes ?? [],
      county: status?.county ?? "",
      lastModified,
      daysSinceUpdate: daysSince(lastModified),
      hasStatusRecord: Boolean(status),
    })
  }
  rows.sort((a, b) => a.name.localeCompare(b.name))
  return rows
}

// ---------------------------------------------------------------------------
// Write
// ---------------------------------------------------------------------------

export interface CaseStatusPatch {
  stages?: string[]
  statusText?: string
}

/**
 * Patch one Status row. Only the keys present in `patch` are sent, so saving
 * the status text can never blank out the stage pills (or the reverse).
 * Throws on a non-ok response so the caller can surface the real failure.
 */
export async function updateCaseStatus(recordId: string, patch: CaseStatusPatch): Promise<void> {
  const fields: Record<string, unknown> = {}
  if (patch.stages !== undefined) fields["Case Stage"] = patch.stages
  if (patch.statusText !== undefined) fields["Case Status - Dashboard"] = patch.statusText
  if (Object.keys(fields).length === 0) return

  const res = await fetch(
    `https://api.airtable.com/v0/${MAIN_BASE_ID}/${STATUS_TABLE_ID}/${encodeURIComponent(recordId)}`,
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
  revalidateCaseStatus()
}

/**
 * Drop the cached board so the next read goes back to Airtable. Called after a
 * save and by the Refresh button.
 *
 * Next 16 requires the second argument; `expire: 0` evicts the entry outright
 * rather than serving one more stale render.
 */
export function revalidateCaseStatus(): void {
  revalidateTag(CASE_STATUS_CACHE_TAG, { expire: 0 })
}

// ---------------------------------------------------------------------------
// Stuck-case detection (deterministic — no model involved)
// ---------------------------------------------------------------------------

export interface CaseFlag {
  recordId: string
  reason: string
}

const STALE_DAYS = 30
// A case only counts as "left behind" once it has sat for at least this long
// AND its peers at the same stage have moved noticeably more recently.
const LEFT_BEHIND_MIN_DAYS = 14

function median(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
}

/**
 * Which cases look stuck. Three plain rules, in priority order:
 *  1. no change on the board in 30+ days
 *  2. nothing written in the client-facing status box
 *  3. sat noticeably longer than every other case at the same stage
 * One reason per case — the first that applies — so the marker stays readable.
 */
export function computeStuckFlags(rows: CaseStatusBoardRow[]): CaseFlag[] {
  // Median staleness of each stage group, so "everyone else moved" is measured
  // against comparable cases rather than the whole board.
  const groups = new Map<string, number[]>()
  for (const row of rows) {
    if (row.daysSinceUpdate === null) continue
    const key = row.stages.length > 0 ? row.stages[0] : "(none)"
    const bucket = groups.get(key)
    if (bucket) bucket.push(row.daysSinceUpdate)
    else groups.set(key, [row.daysSinceUpdate])
  }

  const flags: CaseFlag[] = []
  for (const row of rows) {
    const days = row.daysSinceUpdate

    if (days !== null && days >= STALE_DAYS) {
      flags.push({ recordId: row.recordId, reason: `No update in ${days} days` })
      continue
    }
    if (!row.statusText.trim()) {
      flags.push({
        recordId: row.recordId,
        reason: row.hasStatusRecord
          ? "No client-facing status written yet"
          : "No status record on the board yet",
      })
      continue
    }
    if (days !== null && days >= LEFT_BEHIND_MIN_DAYS) {
      const key = row.stages.length > 0 ? row.stages[0] : "(none)"
      const peers = groups.get(key) ?? []
      const mid = median(peers)
      if (mid !== null && peers.length > 2 && days >= mid * 2) {
        flags.push({
          recordId: row.recordId,
          reason: `Sitting at this stage ${days} days while similar cases moved within ${Math.round(mid)}`,
        })
      }
    }
  }
  return flags
}
