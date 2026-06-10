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
      { headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}` }, next: { revalidate: 60 } }
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

// Uncached fetch of all clients (no Next data-cache layer). The cached,
// timestamped wrapper lives in lib/clients-cache.ts so this module stays free
// of next/cache imports (which break the node test environment).
export async function fetchAllClientsRaw(): Promise<AirtableClient[]> {
  const res = await fetch(`https://api.airtable.com/v0/${MAIN_BASE_ID}/Clients`, {
    headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}` },
    cache: "no-store",
  })
  if (!res.ok) throw new Error(`Airtable error: ${res.status}`)
  const data = await res.json()
  return (data.records ?? []).map((r: any): AirtableClient => mapClientRecord(r))
}
