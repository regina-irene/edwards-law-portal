// lib/billing.ts — flat-fee billing for the Case Status / Invoicing page.
// Fees come from the "Client Fees" table and payments from the "Client Payments"
// table in the main Airtable base (see docs/superpowers/specs/2026-06-09-invoicing-page-design.md).
// Both link to the Clients table; rows are matched by the client's record id.

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY!
const MAIN_BASE_ID = process.env.AIRTABLE_MAIN_BASE_ID!

export const PAY_NOW_URL = "https://tinyurl.com/eflpay"

export interface FeeRow {
  id: string
  description: string
  amount: number
  dueDate: string | null
}

export interface PaymentRow {
  id: string
  description: string
  amount: number
  date: string | null
}

export type FeeStatus = "paid" | "partial" | "due"

export interface ScheduleItem extends FeeRow {
  status: FeeStatus
  paidAmount: number
}

export interface BillingSummary {
  totalFees: number
  totalPaid: number
  balance: number
  schedule: ScheduleItem[]
  payments: PaymentRow[]
}

// Pure math, unit-tested. Payments are pooled and applied to fees oldest
// due date first (undated fees last), so Regina never has to match a payment
// to a specific fee. Returns null when the client has no billing data at all.
export function computeBilling(fees: FeeRow[], payments: PaymentRow[]): BillingSummary | null {
  if (fees.length === 0 && payments.length === 0) return null

  const schedule: ScheduleItem[] = fees
    .slice()
    .sort((a, b) => {
      if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate)
      if (a.dueDate) return -1
      if (b.dueDate) return 1
      return 0
    })
    .map((f) => ({ ...f, status: "due" as FeeStatus, paidAmount: 0 }))

  const totalFees = fees.reduce((sum, f) => sum + f.amount, 0)
  const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0)

  let pool = totalPaid
  for (const item of schedule) {
    if (pool <= 0) break
    item.paidAmount = Math.min(pool, item.amount)
    pool -= item.paidAmount
    item.status = item.paidAmount >= item.amount ? "paid" : "partial"
  }

  const sortedPayments = payments.slice().sort((a, b) => {
    if (a.date && b.date) return b.date.localeCompare(a.date)
    if (a.date) return -1
    if (b.date) return 1
    return 0
  })

  return { totalFees, totalPaid, balance: totalFees - totalPaid, schedule, payments: sortedPayments }
}

interface AirtableRecord {
  id: string
  fields: Record<string, unknown>
}

// Fetches every record in a table (follows Airtable pagination). Cached 60s
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

function linkedTo(record: AirtableRecord, clientRecordId: string): boolean {
  const links = record.fields["Client"]
  return Array.isArray(links) && links.includes(clientRecordId)
}

// clientRecordId is the client's record id in the Clients table (AirtableClient.id).
// Fails soft: any Airtable problem just hides the billing section rather than
// breaking the page.
export async function getClientBilling(clientRecordId: string): Promise<BillingSummary | null> {
  try {
    const [feeRecords, paymentRecords] = await Promise.all([
      fetchAllRecords("Client Fees"),
      fetchAllRecords("Client Payments"),
    ])

    const fees: FeeRow[] = feeRecords
      .filter((r) => linkedTo(r, clientRecordId))
      .map((r) => ({
        id: r.id,
        description: String(r.fields["Description"] ?? "Fee"),
        amount: Number(r.fields["Amount"] ?? 0),
        dueDate: typeof r.fields["Due Date"] === "string" ? r.fields["Due Date"] : null,
      }))

    const payments: PaymentRow[] = paymentRecords
      .filter((r) => linkedTo(r, clientRecordId))
      .map((r) => ({
        id: r.id,
        description: String(r.fields["Description"] ?? "Payment"),
        amount: Number(r.fields["Amount"] ?? 0),
        date: typeof r.fields["Payment Date"] === "string" ? r.fields["Payment Date"] : null,
      }))

    return computeBilling(fees, payments)
  } catch {
    return null
  }
}
