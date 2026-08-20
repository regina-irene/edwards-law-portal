// lib/status-fields.ts - which Status-board fields a client is allowed to see.
//
// The Status table (tbl3gCA0CQ0S6ewW6) is the firm's INTERNAL board. It holds
// payment status, the assigned judge, drafting reminders ("KW get OP's DOB"),
// formulas and notes that were never written for a client to read. So the rule
// here is one way round and only one way round:
//
//   a field is hidden from clients unless somebody explicitly switched it on.
//
// DEFAULT_VISIBLE is the exact set the client Case Status page already showed
// before this control existed, so turning the feature on changes nothing. Every
// other field on the board - including any field added to it tomorrow - starts
// hidden. Nothing here may ever flip that around: if the settings can't be read
// (database down, bad JSON, anything) we fall back to DEFAULT_VISIBLE, which
// shows LESS than any customised setting could, never more.
import { unstable_cache, revalidateTag } from "next/cache"
import { getSetting, setSetting } from "@/lib/app-settings"

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY!
const MAIN_BASE_ID = process.env.AIRTABLE_MAIN_BASE_ID!

/** The Status board, by id so renaming the table on the board can't break it. */
export const STATUS_TABLE_ID = "tbl3gCA0CQ0S6ewW6"

/** Cache tag for the discovered field list. */
export const STATUS_FIELDS_TAG = "status-fields"

const GLOBAL_KEY = "status_fields:global"
const CLIENT_KEY_PREFIX = "status_fields:"

/**
 * Exactly the Status-board fields the client Case Status page showed before
 * this control existed. Everything NOT in this list defaults to hidden.
 *
 * "Plf /  Dft" really does have two spaces in it on the board.
 */
export const DEFAULT_VISIBLE: string[] = [
  "Case Stage",
  "Case Filed",
  "Service Perfected?",
  "Date of Service",
  "Answer Filed?",
  "Date Answer Filed",
  "County",
  "Judge",
  "Case Type",
  "Plf /  Dft",
  "Payment Status",
]

/**
 * Fields the Case Status page renders in its own right, outside the Case File
 * card - the status write-up at the top and its "Updated by EFL" stamp. They
 * are not offered as toggles (there is nothing to toggle: the page is built
 * around them) and they are never repeated in the extra-fields list.
 */
export const NOT_CONFIGURABLE: string[] = [
  // The client-facing status is the write-up at the top of the page; there is
  // nothing to toggle.
  "Case Status - For Client",
  // The internal note is not offered at all. It is not a field a client may be
  // shown, so it must never appear in the list of things that can be switched on.
  "Case Status - Dashboard",
  "Last Modified",
]

/**
 * Everything the page already puts on screen. The extra-fields section at the
 * bottom of the Case File card subtracts this, so nothing appears twice.
 */
export const ALREADY_ON_PAGE: ReadonlySet<string> = new Set<string>([
  ...DEFAULT_VISIBLE,
  ...NOT_CONFIGURABLE,
])

/**
 * Field names on the Status table, discovered from the data.
 *
 * Deliberately NOT the Airtable Meta API - that needs `schema.bases:read`,
 * which the portal's token may not carry. Instead: read a page of records with
 * no `fields` filter and union the keys. Airtable omits empty fields per
 * record, so one record is never enough; 100 records covers the board.
 */
async function loadStatusFieldNames(): Promise<string[]> {
  try {
    // No fetch-level cache option: unstable_cache does the caching, and setting
    // one inside it makes Next log an "ignored fetch cache" warning per miss.
    const res = await fetch(
      `https://api.airtable.com/v0/${MAIN_BASE_ID}/${STATUS_TABLE_ID}?pageSize=100`,
      { headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}` } }
    )
    if (!res.ok) throw new Error(`Airtable error: ${res.status}`)
    const data = (await res.json()) as { records?: { fields?: Record<string, unknown> }[] }
    const names = new Set<string>()
    for (const record of data.records ?? []) {
      for (const key of Object.keys(record.fields ?? {})) {
        if (key.trim()) names.add(key)
      }
    }
    return [...names].sort((a, b) => a.localeCompare(b))
  } catch {
    // Fail soft. An empty list means the admin screen says it couldn't read the
    // board - it never means "show everything".
    return []
  }
}

/** Cached 5 minutes; the board's shape changes rarely. */
export const getStatusFieldNames: () => Promise<string[]> = unstable_cache(
  loadStatusFieldNames,
  ["status-field-names"],
  { revalidate: 300, tags: [STATUS_FIELDS_TAG] }
)

/**
 * Drop the cached list and read the board again, for the admin "Re-read the
 * board" button. Reads directly rather than through the cache, because a tag
 * dropped mid-request isn't guaranteed to be gone by the next read in it.
 * Next 16 requires the second argument to revalidateTag.
 */
export async function refreshStatusFieldNames(): Promise<string[]> {
  revalidateTag(STATUS_FIELDS_TAG, { expire: 0 })
  return loadStatusFieldNames()
}

/** The portal's clientId IS the Status record id, occasionally comma-joined. */
function recordIdOf(clientId: string): string {
  return String(clientId).split(",")[0].trim()
}

function clientKey(clientId: string): string {
  return CLIENT_KEY_PREFIX + recordIdOf(clientId)
}

/** Tolerant parse: anything that isn't a plain map of booleans is ignored. */
function parsePrefs(raw: string): Record<string, boolean> {
  if (!raw) return {}
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {}
    const out: Record<string, boolean> = {}
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (key.trim() && typeof value === "boolean") out[key] = value
    }
    return out
  } catch {
    return {}
  }
}

/** Firm-wide overrides of DEFAULT_VISIBLE. Fails soft to {}. */
export async function getGlobalFieldPrefs(): Promise<Record<string, boolean>> {
  return parsePrefs(await getSetting(GLOBAL_KEY))
}

/** Throws if the write fails, so the caller can show a real error. */
export async function saveGlobalFieldPrefs(prefs: Record<string, boolean>): Promise<void> {
  await setSetting(GLOBAL_KEY, JSON.stringify(prefs))
}

/**
 * One client's overrides. Only explicitly-set keys are stored - a field absent
 * from this map INHERITS the firm-wide value.
 */
export async function getClientFieldPrefs(clientId: string): Promise<Record<string, boolean>> {
  const id = recordIdOf(clientId)
  if (!id.startsWith("rec")) return {}
  return parsePrefs(await getSetting(clientKey(id)))
}

/** Throws if the write fails, so the caller can show a real error. */
export async function saveClientFieldPrefs(
  clientId: string,
  prefs: Record<string, boolean>
): Promise<void> {
  const id = recordIdOf(clientId)
  if (!id.startsWith("rec")) throw new Error("Invalid client record id")
  await setSetting(clientKey(id), JSON.stringify(prefs))
}

/**
 * The fields this client may see: DEFAULT_VISIBLE, then the firm-wide setting,
 * then that client's own overrides - in that order, last one wins.
 *
 * Fails closed. Both reads return {} on any error, so the worst case is the
 * set the page showed before this control existed.
 */
export async function resolveVisibleFields(clientId: string): Promise<Set<string>> {
  const visible = new Set<string>(DEFAULT_VISIBLE)
  const [global, client] = await Promise.all([
    getGlobalFieldPrefs().catch(() => ({}) as Record<string, boolean>),
    getClientFieldPrefs(clientId).catch(() => ({}) as Record<string, boolean>),
  ])
  for (const [name, on] of Object.entries(global)) {
    if (on) visible.add(name)
    else visible.delete(name)
  }
  for (const [name, on] of Object.entries(client)) {
    if (on) visible.add(name)
    else visible.delete(name)
  }
  // Belt and braces. NOT_CONFIGURABLE holds fields a client may never be shown
  // as a row on their page, including the firm's internal status note. Enforced
  // HERE, at the point of use, rather than trusted to the admin UI never having
  // offered them: a stale `true` saved before this list grew, or any future
  // caller of saveFieldPrefs, must not be able to switch one back on.
  for (const name of NOT_CONFIGURABLE) visible.delete(name)
  return visible
}

/**
 * The list the admin screens offer: every discovered field, plus anything in
 * DEFAULT_VISIBLE that happened to be empty across the sampled records (so a
 * field that IS on screen can always be switched off), minus the ones the page
 * renders on its own terms.
 */
export function configurableFieldNames(discovered: string[]): string[] {
  const skip = new Set(NOT_CONFIGURABLE)
  const names = new Set<string>()
  for (const name of [...discovered, ...DEFAULT_VISIBLE]) {
    if (name.trim() && !skip.has(name)) names.add(name)
  }
  return [...names].sort((a, b) => a.localeCompare(b))
}
