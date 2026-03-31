const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY!
const MAIN_BASE_ID = process.env.AIRTABLE_MAIN_BASE_ID!

export interface AirtableClient {
  id: string
  clientId: string
  name: string
  email: string
  phone: string
  clientBaseId: string
  fileflowLink: string
  pleadingsViewLink: string
  discoveryViewLink: string
  calendarViewLink: string
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
  return {
    id: r.id,
    clientId: r.fields["Client ID"] ?? "",
    name: r.fields["Name"] ?? "",
    email: r.fields["Email"] ?? "",
    phone: r.fields["Phone"] ?? "",
    clientBaseId: r.fields["Client Base ID"] ?? "",
    fileflowLink: r.fields["FileFlow Link"] ?? "",
    pleadingsViewLink: r.fields["Pleadings View Link"] ?? "",
    discoveryViewLink: r.fields["Discovery View Link"] ?? "",
    calendarViewLink: r.fields["Calendar View Link"] ?? "",
    smsReminders: r.fields["SMS Reminders"] === true,
  }
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

export async function getAllClients(): Promise<AirtableClient[]> {
  const data = await airtableFetch(
    `https://api.airtable.com/v0/${MAIN_BASE_ID}/Clients`
  )
  if (!data.records) return []
  return data.records.map((r: any): AirtableClient => ({
    id: r.id,
    clientId: r.fields["Client ID"] ?? "",
    name: r.fields["Name"] ?? "",
    email: r.fields["Email"] ?? "",
    phone: r.fields["Phone"] ?? "",
    clientBaseId: r.fields["Client Base ID"] ?? "",
    fileflowLink: r.fields["FileFlow Link"] ?? "",
    pleadingsViewLink: r.fields["Pleadings View Link"] ?? "",
    discoveryViewLink: r.fields["Discovery View Link"] ?? "",
    calendarViewLink: r.fields["Calendar View Link"] ?? "",
    smsReminders: r.fields["SMS Reminders"] === true,
  }))
}
