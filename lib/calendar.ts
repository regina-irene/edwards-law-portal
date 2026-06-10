// lib/calendar.ts — calendar events for a client's case, read from the
// Google-Calendar-synced events table in the main Airtable base (table ".",
// tbl6VxRlXtmEATGio), where each event links to the case's Status record.
// The portal clientId IS the Status record id, so matching is direct.

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY!
const MAIN_BASE_ID = process.env.AIRTABLE_MAIN_BASE_ID!

export interface CaseEvent {
  id: string
  title: string
  start: string // ISO datetime
  end: string | null
  allDay: boolean
  location: string
  description: string
  zoomLink: string
  eventLink: string
  status: string
}

function text(v: unknown): string {
  return typeof v === "string" ? v.trim() : ""
}

export async function getCaseEvents(clientId: string): Promise<CaseEvent[] | null> {
  const statusRecordId = String(clientId).split(",")[0].trim()
  if (!statusRecordId.startsWith("rec")) return null
  try {
    const records: { id: string; fields: Record<string, unknown> }[] = []
    let offset: string | undefined
    do {
      const url =
        `https://api.airtable.com/v0/${MAIN_BASE_ID}/tbl6VxRlXtmEATGio` +
        (offset ? `?offset=${encodeURIComponent(offset)}` : "")
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}` },
        cache: "no-store",
      })
      if (!res.ok) throw new Error(`Airtable error: ${res.status}`)
      const data = await res.json()
      records.push(...(data.records ?? []))
      offset = data.offset
    } while (offset)

    const events: CaseEvent[] = records
      .filter((r) => {
        const links = r.fields["EFL Status (name of case)"]
        return Array.isArray(links) && links.includes(statusRecordId)
      })
      .map((r) => ({
        id: r.id,
        title: text(r.fields["Title"]) || "Event",
        start: text(r.fields["Start"]),
        end: text(r.fields["End"]) || null,
        allDay: r.fields["All Day"] === true,
        location: text(r.fields["Location"]),
        description: text(r.fields["Description"]),
        zoomLink: text(r.fields["Zoom Link"]),
        eventLink: text(r.fields["Event Link"]),
        status: text(r.fields["Status"]),
      }))
      .filter((e) => e.start && e.status.toLowerCase() !== "cancelled")
      .sort((a, b) => a.start.localeCompare(b.start))

    return events
  } catch {
    return null
  }
}

// The next upcoming event that looks like a court date (hearing/trial/court/
// mediation keywords); falls back to the next upcoming event of any kind.
export function nextCourtDate(events: CaseEvent[]): CaseEvent | null {
  const now = new Date().toISOString()
  const upcoming = events.filter((e) => e.start >= now)
  if (upcoming.length === 0) return null
  const courtish = upcoming.find((e) => /\b(hearing|trial|court|calendar call|mediation|deposition)\b/i.test(e.title))
  return courtish ?? upcoming[0]
}
