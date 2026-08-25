// lib/pleadings.ts - reads the "Pleadings" table from a client's own Airtable
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
  /** Record created datetime - used only to order rows whose name has no date.
   *  Never shown as the filing date: it is the Drive-sync time, not the date on
   *  the document. */
  created: string | null
  filedBy: string
  fileType: string
  link: string
  notes: string
  /** Subfolder the file sits in ("TPO", "FV matter"), else null for top-level
   *  filings. Shown as a tag and used to tint the row. */
  folder: string | null
}

// "2019.08.19 Final Decree of Divorce (Lindholm).pdf"
//   → { filedOn: "2019-08-19", title: "2019.08.19 Final Decree of Divorce" }
// The Document column keeps the leading date in the name (Regina, 2026-07-23)
// but drops the file extension and the short trailing case tag. The date is
// also parsed out for the Date column, sorting, and Recent Filings.
// Files that live in a subfolder of the Drive folder come across with the
// folder in front of the name ("TPO/2026.05.04 FILED - …pdf"), so strip any
// folder path first - otherwise the leading date never matches and the row
// falls back to the sync date instead of the date on the document. The folder
// itself comes back too ("TPO"), for the tag and row color on the table.
export function parsePleadingName(raw: string): {
  title: string
  filedOn: string | null
  folder: string | null
} {
  const segments = raw.trim().split(/[/\\]/).map((s) => s.trim()).filter(Boolean)
  const parent = segments.length > 1 ? segments[segments.length - 2] : ""
  // "Pleadings/…" in some bases is the table's own folder, not a subfolder
  const folder = parent && parent.toLowerCase() !== "pleadings" ? parent : null
  const name = (segments.pop() ?? "")
    .replace(/\.(pdf|docx?|xlsx?|pptx?|jpe?g|png|gif|txt|rtf)$/i, "")
    .replace(/\s*\([^()]{1,25}\)\s*$/, "")
  // leading date in YYYY.MM.DD / YYYY-MM-DD / YYYY_MM_DD form
  const m = name.match(/^(\d{4})[.\-_](\d{1,2})[.\-_](\d{1,2})\s*[-–—.]?\s*/)
  if (!m) return { title: name, filedOn: null, folder }
  const [, y, mo, d] = m
  return { title: name, filedOn: `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`, folder }
}

function text(v: unknown): string {
  return typeof v === "string" ? v.trim() : ""
}


/**
 * The value that carries the file's FOLDER PATH, from whichever column holds it.
 *
 * Client bases disagree about which column that is. Some put the full path in
 * "File Path" ("Divorce/2024.01.09 Answer.pdf") while also having a "Name"
 * column holding just the bare filename; others only have one of the two.
 *
 * So the candidates are searched for one that actually contains a slash rather
 * than trusting a fixed order. Preferring "Name" cost Gichana its folder
 * colours: every row looked path-less, so the "which folder is the table's own
 * root" test decided BOTH Divorce and Contempt were the root and threw both
 * away, leaving every filing untagged and untinted. (2026-08-22)
 */
function pathBearing(values: string[]): string {
  return values.find((v) => v && /[/\\]/.test(v)) ?? values.find(Boolean) ?? ""
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

    const rawNameOf = (f: Record<string, unknown>) =>
      pathBearing([text(f["File Path"]), text(f["Name of File"]), text(f["Name"])])

    // Which folder is the table's own (top-level) one? Whatever the files that
    // carry no folder path in their name sit in - anything else is a subfolder.
    const rootFolders = new Set(
      records
        .filter((r) => !/[/\\]/.test(rawNameOf(r.fields)))
        .map((r) => text(r.fields["Parent Folder"]).toLowerCase())
        .filter(Boolean)
    )

    const docs = records
      .map((r) => {
        const f = r.fields
        const rawName = rawNameOf(f)
        const { title, filedOn, folder } = parsePleadingName(rawName)
        const parentFolder = text(f["Parent Folder"])
        return {
          id: r.id,
          title,
          filedOn,
          // the name usually carries the path; fall back to the synced
          // "Parent Folder" for bases that sync bare file names
          folder:
            folder ??
            (parentFolder && !rootFolders.has(parentFolder.toLowerCase()) ? parentFolder : null),
          created: text(f["Created"]) || null,
          filedBy: text(f["Filed by:"]) || text(f["Filed by"]) || text(f["Filed By"]),
          fileType: text(typeof f["File Type"] === "string" ? f["File Type"] : "") ||
            (rawName.match(/\.(\w{2,4})$/)?.[1] ?? ""),
          link: text(f["Link"]),
          notes: text(f["Notes"]),
        }
      })
      // the subfolder itself syncs in as a row ("FV matter", File Type "folder") - 
      // it isn't a filing, and its files are listed individually
      .filter((d) => d.title && d.fileType.toLowerCase() !== "folder")

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
