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

// ---- Google Calendar sync cleanup ----------------------------------------
// Synced events arrive messy: HTML entities (&amp;), raw <a> tags, Google
// redirect-wrapped URLs (google.com/url?q=...), Zoom links in the Location
// field, and Zoom invite boilerplate in the description.

export function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
}

// "https://www.google.com/url?q=https://zoom.us/j/123&sa=D&..." → the real URL
export function unwrapGoogleRedirect(url: string): string {
  if (!/google\.com\/url/i.test(url)) return url
  try {
    const q = new URL(url).searchParams.get("q")
    return q || url
  } catch {
    return url
  }
}

export function cleanDescription(raw: string): string {
  let s = decodeEntities(raw)
  s = s.replace(/<[^>]*>/g, " ") // strip HTML tags
  s = s.split(/[─—_-]{6,}/)[0] // keep only what's before a divider line
  // drop Zoom invite boilerplate from wherever it starts
  s = s.replace(/[^.\n]*is inviting you to a scheduled Zoom meeting[\s\S]*$/i, "")
  s = s.replace(/Join Zoom Meeting[\s\S]*$/i, "")
  s = s.replace(/https?:\/\/[^\s]+/g, "") // bare URLs add noise; links render separately
  // collapse runs of spaces but PRESERVE line breaks (notes are often multi-line)
  s = s
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
  return s.trim()
}

// The Zoom link might live in the Zoom Link field OR be buried in the event
// description/notes/location. Find the first zoom.us/zoom.com URL anywhere
// (unwrapping Google redirects); fall back to the Zoom Link field if it's any
// URL at all.
function findZoomUrl(...sources: string[]): string {
  for (const raw of sources) {
    const s = decodeEntities(raw)
    const urls = (s.match(/https?:\/\/[^\s<>"')\]]+/gi) ?? []).map(unwrapGoogleRedirect)
    const zoom = urls.find((u) => /zoom\.(us|com)/i.test(u))
    if (zoom) return zoom
  }
  const first = decodeEntities(sources[0] ?? "")
  return /^https?:\/\//i.test(first) ? unwrapGoogleRedirect(first) : ""
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
        next: { revalidate: 60 }, // fast nav; Refresh button revalidates the path for instant freshness
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
      .map((r) => {
        const rawLocation = text(r.fields["Location"])
        const rawDescription = text(r.fields["Description"])
        const location = decodeEntities(rawLocation)
        return {
          id: r.id,
          title: decodeEntities(text(r.fields["Title"])) || "Event",
          start: text(r.fields["Start"]),
          end: text(r.fields["End"]) || null,
          allDay: r.fields["All Day"] === true,
          // a URL in the Location field is a meeting link, not a place — no 📍
          location: /^https?:\/\//i.test(location) ? "" : location,
          description: cleanDescription(rawDescription),
          zoomLink: findZoomUrl(text(r.fields["Zoom Link"]), rawDescription, rawLocation),
          eventLink: text(r.fields["Event Link"]),
          status: text(r.fields["Status"]),
        }
      })
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
