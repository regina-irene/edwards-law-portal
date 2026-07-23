// lib/pleadings.ts — reads the "Pleadings" table from a client's own Airtable
// base and turns the Drive-synced file rows into a clean docket list.
// Client bases vary slightly (some use "Name of File", others "Name"/"File Path"),
// so field lookups are tolerant. Fails soft: null → the page falls back to the
// old embed view.

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY!

export interface PleadingDoc {
  id: string
  title: string
  /** Filing date parsed from the file name ("2019.08.19 Final Decree…"), else null */
  filedOn: string | null
  /** Record created datetime — fallback ordering when no filing date in the name */
  created: string | null
  filedBy: string
  fileType: string
  link: string
  notes: string
}

// "2019.08.19 Final Decree of Divorce (Lindholm).pdf"
//   → { filedOn: "2019-08-19", title: "2019.08.19 Final Decree of Divorce (Lindholm)" }
// The Document column shows the FULL file name — leading date and case tag
// included (Regina, 2026-07-23); only the file extension is dropped. The date
// is still parsed out for the Date column, sorting, and Recent Filings.
export function parsePleadingName(raw: string): { title: string; filedOn: string | null } {
  const name = raw.trim().replace(/\.(pdf|docx?|xlsx?|pptx?|jpe?g|png|gif|txt|rtf)$/i, "")
  // leading date in YYYY.MM.DD / YYYY-MM-DD / YYYY_MM_DD form
  const m = name.match(/^(\d{4})[.\-_](\d{1,2})[.\-_](\d{1,2})\s*[-–—.]?\s*/)
  if (!m) return { title: name, filedOn: null }
  const [, y, mo, d] = m
  return { title: name, filedOn: `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}` }
}

function text(v: unknown): string {
  return typeof v === "string" ? v.trim() : ""
}

export async function getPleadings(clientBaseId: string): Promise<PleadingDoc[] | null> {
  if (!clientBaseId) return null
  try {
    const records: { id: string; fields: Record<string, unknown> }[] = []
    let offset: string | undefined
    do {
      const url =
        `https://api.airtable.com/v0/${clientBaseId}/Pleadings` +
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
      .map((r) => {
        const f = r.fields
        const rawName =
          text(f["Name of File"]) ||
          text(f["Name"]) ||
          text(f["File Path"]).split("/").pop()?.trim() ||
          ""
        const { title, filedOn } = parsePleadingName(rawName)
        return {
          id: r.id,
          title,
          filedOn,
          created: text(f["Created"]) || null,
          filedBy: text(f["Filed by:"]) || text(f["Filed by"]) || text(f["Filed By"]),
          fileType: text(typeof f["File Type"] === "string" ? f["File Type"] : "") ||
            (rawName.match(/\.(\w{2,4})$/)?.[1] ?? ""),
          link: text(f["Link"]),
          notes: text(f["Notes"]),
        }
      })
      .filter((d) => d.title)

    // newest filing first; rows without a parsed date sort by record creation
    docs.sort((a, b) => {
      const ka = a.filedOn ?? (a.created ?? "").slice(0, 10)
      const kb = b.filedOn ?? (b.created ?? "").slice(0, 10)
      return kb.localeCompare(ka)
    })

    return docs
  } catch {
    return null
  }
}
