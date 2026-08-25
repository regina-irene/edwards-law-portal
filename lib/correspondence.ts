// lib/correspondence.ts - reads the "Correspondence" table from a client's own
// Airtable base and turns the Drive-synced file rows into a clean letter list.
// Same Drive-synced shape as Pleadings, so the file-name parsing is shared:
// the primary field is "File Path" rather than "Name of File", and the person
// field is "Sent by:" rather than "Filed by:". Client bases vary slightly, so
// field lookups are tolerant. Fails soft: null → the page falls back to the
// old embed view.

import { parsePleadingName } from "@/lib/pleadings"

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY!

export interface CorrespondenceDoc {
  id: string
  title: string
  /** Date parsed from the file name ("2026.08.11 Letter to OC…"), else null */
  sentOn: string | null
  /** Record created datetime - used only to order rows whose name has no date.
   *  Never shown as the sent date: it is the Drive-sync time, not the date on
   *  the letter. */
  created: string | null
  sentBy: string
  fileType: string
  link: string
  notes: string
  /** Subfolder the file sits in ("Opposing Counsel", "Client"), else null for
   *  top-level letters. Shown as a tag and used to tint the row. */
  folder: string | null
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

export async function getCorrespondence(clientBaseId: string): Promise<CorrespondenceDoc[] | null> {
  if (!clientBaseId) return null
  try {
    const records: { id: string; fields: Record<string, unknown> }[] = []
    let offset: string | undefined
    do {
      const url =
        `https://api.airtable.com/v0/${clientBaseId}/Correspondence` +
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

    // "File Path" is this table's primary field; the other two are here for
    // bases that were set up the Pleadings way.
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
        // shared with Pleadings - the naming convention is identical
        // ("2026.08.11 Letter to OC (Smith).pdf")
        const { title, filedOn: sentOn, folder: parsedFolder } = parsePleadingName(rawName)
        // "Correspondence/…" is this table's own folder, not a subfolder - 
        // the shared parser only knows to drop a leading "Pleadings/"
        const folder =
          parsedFolder && parsedFolder.toLowerCase() !== "correspondence" ? parsedFolder : null
        const parentFolder = text(f["Parent Folder"])
        return {
          id: r.id,
          title,
          sentOn,
          // the name usually carries the path; fall back to the synced
          // "Parent Folder" for bases that sync bare file names
          folder:
            folder ??
            (parentFolder && !rootFolders.has(parentFolder.toLowerCase()) ? parentFolder : null),
          created: text(f["Created"]) || null,
          sentBy: text(f["Sent by:"]) || text(f["Sent By"]) || text(f["Sent by"]),
          fileType: text(typeof f["File Type"] === "string" ? f["File Type"] : "") ||
            (rawName.match(/\.(\w{2,4})$/)?.[1] ?? ""),
          link: text(f["Link"]),
          notes: text(f["Notes"]),
        }
      })
      // the subfolder itself syncs in as a row ("Opposing Counsel", File Type
      // "folder") - it isn't a letter, and its files are listed individually
      .filter((d) => d.title && d.fileType.toLowerCase() !== "folder")

    // newest letter first; rows without a parsed date sort by record creation
    docs.sort((a, b) => {
      const ka = a.sentOn ?? (a.created ?? "").slice(0, 10)
      const kb = b.sentOn ?? (b.created ?? "").slice(0, 10)
      return kb.localeCompare(ka)
    })

    return docs
  } catch {
    return null
  }
}
