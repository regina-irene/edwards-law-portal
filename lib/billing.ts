// lib/billing.ts — flat-fee billing for the Case Status / Invoicing page.
// One board: the "Client Payments" table in the main Airtable base. Each row is
// a fee the client owes (Description, Amount, Due Date, Client link, Status).
// Regina flips Status to "Paid" when the client pays. Rows with no Amount are
// placeholders and are ignored.

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY!
const MAIN_BASE_ID = process.env.AIRTABLE_MAIN_BASE_ID!

export const PAY_NOW_URL = "https://tinyurl.com/eflpay"

export interface FeeRow {
  id: string
  description: string
  amount: number
  dueDate: string | null
  paid: boolean
}

export interface BillingSummary {
  totalFees: number
  totalPaid: number
  balance: number
  schedule: FeeRow[]
}

// Pure math, unit-tested. Returns null when the client has no fee rows at all
// (the page then renders exactly as it did before billing existed).
export function computeBilling(fees: FeeRow[]): BillingSummary | null {
  if (fees.length === 0) return null

  const schedule = fees.slice().sort((a, b) => {
    if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate)
    if (a.dueDate) return -1
    if (b.dueDate) return 1
    return 0
  })

  const totalFees = fees.reduce((sum, f) => sum + f.amount, 0)
  const totalPaid = fees.filter((f) => f.paid).reduce((sum, f) => sum + f.amount, 0)

  return { totalFees, totalPaid, balance: totalFees - totalPaid, schedule }
}

interface AirtableRecord {
  id: string
  fields: Record<string, unknown>
}

// Fetches every record in the table (follows Airtable pagination). Cached 60s
// like the rest of the portal's Airtable reads.
async function fetchAllRecords(tableName: string): Promise<AirtableRecord[]> {
  const records: AirtableRecord[] = []
  let offset: string | undefined
  do {
    const url =
      `https://api.airtable.com/v0/${MAIN_BASE_ID}/${encodeURIComponent(tableName)}` +
      (offset ? `?offset=${encodeURIComponent(offset)}` : "")
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}` },
      next: { revalidate: 60 },
    })
    if (!res.ok) throw new Error(`Airtable error: ${res.status}`)
    const data = await res.json()
    records.push(...(data.records ?? []))
    offset = data.offset
  } while (offset)
  return records
}

// clientRecordId is the client's record id in the Clients table (AirtableClient.id).
// Fails soft: any Airtable problem just hides the billing section rather than
// breaking the page.
export async function getClientBilling(clientRecordId: string): Promise<BillingSummary | null> {
  try {
    const records = await fetchAllRecords("Client Payments")

    const fees: FeeRow[] = records
      .filter((r) => {
        const links = r.fields["Client"]
        const amount = Number(r.fields["Amount"] ?? 0)
        return Array.isArray(links) && links.includes(clientRecordId) && amount !== 0
      })
      .map((r) => ({
        id: r.id,
        description: String(r.fields["Description"] ?? "") || "Fee",
        amount: Number(r.fields["Amount"] ?? 0),
        dueDate: typeof r.fields["Due Date"] === "string" ? r.fields["Due Date"] : null,
        paid: r.fields["Status"] === "Paid",
      }))

    return computeBilling(fees)
  } catch {
    return null
  }
}
