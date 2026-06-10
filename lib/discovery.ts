// lib/discovery.ts — reads the "Discovery" table from a client's own Airtable
// base. ONLY rows with "Avail. to Client" checked are returned — that checkbox
// is the firm's gate for what clients may see. Fails soft: null → the page
// falls back to the old embed view.

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY!

export interface DiscoveryDoc {
  id: string
  title: string
  date: string | null
  direction: string
  tags: string[]
  notes: string
  link: string
}

function text(v: unknown): string {
  return typeof v === "string" ? v.trim() : ""
}

export async function getDiscovery(clientBaseId: string): Promise<DiscoveryDoc[] | null> {
  if (!clientBaseId) return null
  try {
    const records: { id: string; fields: Record<string, unknown> }[] = []
    let offset: string | undefined
    do {
      const url =
        `https://api.airtable.com/v0/${clientBaseId}/Discovery` +
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

    const docs = records
      .filter((r) => r.fields["Avail. to Client"] === true)
      .map((r) => {
        const f = r.fields
        return {
          id: r.id,
          title: text(f["Name"]).replace(/\s+/g, " "),
          date: text(f["Date"]) || null,
          direction: text(f["Incoming or Outgoing"]),
          tags: (Array.isArray(f["Tags"]) ? f["Tags"] : []).map((t: unknown) => String(t).trim()).filter(Boolean),
          notes: text(f["Notes"]),
          link: text(f["URL"]),
        }
      })
      .filter((d) => d.title)

    // newest first
    docs.sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""))
    return docs
  } catch {
    return null
  }
}
