import { unstable_cache, revalidateTag } from "next/cache"

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY!
const MAIN_BASE_ID = process.env.AIRTABLE_MAIN_BASE_ID!

export interface AirtableClient {
  id: string
  clientId: string
  name: string
  email: string
  phone: string
  clientBaseId: string
  statusOfCase: string
  smsReminders: boolean
  noMessageEmails: boolean
}

export interface AirtableTask {
  id: string
  name: string
  status: string
  dueDate: string | null
  type: string
  matter: string
}

function mapClientRecord(r: any): AirtableClient {
  return {
    id: r.id,
    clientId: r.fields["Client ID"] ?? "",
    name: r.fields["Name"] ?? "",
    email: r.fields["Email"] ?? "",
    phone: r.fields["Phone"] ?? "",
    clientBaseId: r.fields["Client Base ID"] ?? "",
    statusOfCase: r.fields["Status of Case"] ?? "",
    smsReminders: r.fields["SMS Reminders"] === true,
    // Opt-OUT checkbox: unchecked (default) = email the client on every firm message
    noMessageEmails: r.fields["No Message Emails"] === true,
  }
}

async function airtableFetch(url: string) {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}` },
    next: { revalidate: 60 },
  })
  if (!res.ok) throw new Error(`Airtable error: ${res.status}`)
  return res.json()
}

export async function getClientByEmail(email: string): Promise<AirtableClient | null> {
  const escapedEmail = email.replace(/'/g, "\\'")
  const formula = encodeURIComponent(`{Email}='${escapedEmail}'`)
  const data = await airtableFetch(
    `https://api.airtable.com/v0/${MAIN_BASE_ID}/Clients?filterByFormula=${formula}&maxRecords=1`
  )
  if (!data.records || data.records.length === 0) return null
  const r = data.records[0]
  return mapClientRecord(r)
}

export async function getClientTasks(clientBaseId: string): Promise<AirtableTask[]> {
  const data = await airtableFetch(
    `https://api.airtable.com/v0/${clientBaseId}/Tasks?sort[0][field]=Due%20Date&sort[0][direction]=asc`
  )
  if (!data.records) return []
  return data.records.map((r: any): AirtableTask => ({
    id: r.id,
    name: r.fields["Task Name"] ?? "",
    status: r.fields["Status"] ?? "",
    dueDate: r.fields["Due Date"] ?? null,
    type: r.fields["Type"] ?? "",
    matter: Array.isArray(r.fields["Matter"]) ? r.fields["Matter"][0] : (r.fields["Matter"] ?? ""),
  }))
}

export interface CaseStatusInfo {
  stages: string[]
  caseTypes: string[]
  county: string
  judge: string
  paymentStatus: string
  plfDft: string
  caseFiled: string | null
  dateOfService: string | null
  servicePerfected: boolean
  answerFiled: boolean
  dateAnswerFiled: string | null
  statusText: string
  lastModified: string | null
}

// The portal's clientId is the client's linked record id in the Status table
// ("Client ID" on Clients is a record link, so String() of it yields "rec...").
// Pulls that Status record's Case Stage pills + when the row last changed.
// Fails soft — the page just skips the pills.
export async function getCaseStatus(clientId: string): Promise<CaseStatusInfo | null> {
  const recordId = String(clientId).split(",")[0].trim()
  if (!recordId.startsWith("rec")) return null
  try {
    // tbl3gCA0CQ0S6ewW6 = the Status table (by id, so renaming it is safe).
    // Cached 60s for fast navigation; Refresh button revalidates the path.
    const res = await fetch(
      `https://api.airtable.com/v0/${MAIN_BASE_ID}/tbl3gCA0CQ0S6ewW6/${recordId}`,
      {
        headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}` },
        // Tagged "case-status" so both the client's Refresh button and a save
        // on the admin Status board drop this straight away, instead of the
        // client seeing up to 60s of stale text after the firm updates it.
        next: { revalidate: 60, tags: ["case-status"] },
      }
    )
    if (!res.ok) throw new Error(`Airtable error: ${res.status}`)
    const data = await res.json()
    const f = data.fields ?? {}
    // Option names are kept EXACTLY as on the board (incl. "4 - " prefixes) so
    // they can be matched to their Airtable colors; the UI prettifies them.
    const selectList = (v: unknown) =>
      (Array.isArray(v) ? v : []).map((s: unknown) => String(s).trim()).filter(Boolean)
    const text = (v: unknown) => (typeof v === "string" ? v.trim() : "")
    const date = (v: unknown) => (typeof v === "string" && v ? v : null)

    return {
      stages: selectList(f["Case Stage"]),
      caseTypes: selectList(f["Case Type"]),
      county: text(f["County"]),
      judge: text(f["Judge"]),
      paymentStatus: text(f["Payment Status"]),
      plfDft: text(f["Plf /  Dft"]), // field name has two spaces on the board
      caseFiled: date(f["Case Filed"]),
      dateOfService: date(f["Date of Service"]),
      servicePerfected: f["Service Perfected?"] === true,
      answerFiled: f["Answer Filed?"] === true,
      dateAnswerFiled: date(f["Date Answer Filed"]),
      // "Case Status - Dashboard" on the Status board is THE case status text for
      // all cases (per Regina) — the old "Status of Case" field on Clients is legacy.
      statusText: text(f["Case Status - Dashboard"]),
      lastModified: date(f["Last Modified"]),
    }
  } catch {
    return null
  }
}

export async function getAllClients(): Promise<AirtableClient[]> {
  const data = await airtableFetch(
    `https://api.airtable.com/v0/${MAIN_BASE_ID}/Clients`
  )
  if (!data.records) return []
  return data.records.map((r: any): AirtableClient => mapClientRecord(r))
}

// Client names are stored in Airtable as "Lastname | Firstname".
// Turn that into a friendly "Lastname, F" label for the admin list.
export function clientDisplayLabel(name: string): string {
  const raw = (name ?? "").trim()
  if (!raw) return ""
  const parts = raw.split("|").map((s) => s.trim()).filter(Boolean)
  const last = parts[0] ?? ""
  const first = parts[1] ?? ""
  if (last && first) return `${last}, ${first.charAt(0).toUpperCase()}`
  return last || first
}

// The client roster, cached (2026-08-18). This is called from ~12 places (the
// admin dashboard, Clients, Field Notes, Forms and several API routes) and it
// used to be cache: "no-store", so every admin render re-fetched the whole
// roster. Airtable allows 5 req/s per base, so a few admin tabs open at once
// produced 429s and pages that rendered with no client names.
// Cached 60s under the "clients" tag; the admin Refresh button busts the tag.
// Safe to wrap: this reads nothing per-request (no cookies/headers), only
// process.env and its own fetch, so every caller sees the same value.
export const CLIENTS_CACHE_TAG = "clients"

async function loadAllClients(): Promise<AirtableClient[]> {
  // No fetch-level cache option here: unstable_cache does the caching, and
  // setting one inside it makes Next log an "ignored fetch cache" warning on
  // every miss.
  const res = await fetch(`https://api.airtable.com/v0/${MAIN_BASE_ID}/Clients`, {
    headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}` },
  })
  if (!res.ok) throw new Error(`Airtable error: ${res.status}`)
  const data = await res.json()
  return (data.records ?? []).map((r: any): AirtableClient => mapClientRecord(r))
}

// Name and return type are unchanged so no call site had to move.
export const fetchAllClientsRaw: () => Promise<AirtableClient[]> = unstable_cache(
  loadAllClients,
  ["airtable-all-clients"],
  { revalidate: 60, tags: [CLIENTS_CACHE_TAG] }
)

// Call from a server action / route handler after the roster changes in
// Airtable, so the next render refetches instead of waiting out the 60s.
// Next 16 requires the second argument. `expire: 0` drops the entry outright so
// the Refresh button refetches immediately, rather than serving one more stale
// render the way the stale-while-revalidate profiles do.
export function revalidateClients(): void {
  revalidateTag(CLIENTS_CACHE_TAG, { expire: 0 })
}
