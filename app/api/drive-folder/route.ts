// app/api/drive-folder/route.ts - what is inside the Google Drive folder a
// Discovery row links to (2026-08-20).
//
// Called from the client's own Discovery page and from the admin Discovery
// board, so it serves both. It is expanded on demand rather than on page load:
// a folder costs several Drive calls and most rows are never opened.
//
// THE CALLER NEVER NAMES A FOLDER.
// It sends a Discovery RECORD id, and this route reads that record's URL from
// Airtable itself. That is the whole security design. Taking a folder id or a
// URL from the browser would turn this into an endpoint that lists any Drive
// folder the service account can reach, for anyone with a portal login - one
// client enumerating another client's discovery. So:
//
//   admin   may expand any record, and must say which base it is in.
//   client  may expand only records in THEIR OWN base, and only rows where
//           "Avail. to Client" is ticked - the same gate lib/discovery applies
//           to the page itself. An untickd row is invisible here too.
import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin"
import { getPortalClient } from "@/lib/portal-client"
import { parseDriveFolderId, summariseDriveFolder } from "@/lib/drive-folder"
import { discoveryRecordUrl, discoveryRecordAvailable } from "@/lib/discovery-board"
import { getAllClients } from "@/lib/airtable"

/** True when this base belongs to one of the firm's own clients. */
async function isClientBase(baseId: string): Promise<boolean> {
  try {
    const clients = await getAllClients()
    return clients.some((c) => String(c.clientBaseId) === baseId)
  } catch {
    // Fail CLOSED: if the roster cannot be read we do not know whose base this
    // is, and guessing in the permissive direction is how folders leak.
    return false
  }
}

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as
    | { recordId?: unknown; baseId?: unknown; refresh?: unknown }
    | null

  const recordId = typeof body?.recordId === "string" ? body.recordId.trim() : ""
  if (!/^rec[A-Za-z0-9]{10,}$/.test(recordId)) {
    return NextResponse.json({ error: "A valid document record is required." }, { status: 400 })
  }

  const admin = await requireAdmin()

  let baseId = ""
  // Keyed on whether a base was SUPPLIED, not merely on being an admin. An
  // admin previewing a client's portal renders the client page, whose peek
  // sends only a recordId - so branching on admin-ness alone made the feature
  // fail on the exact path the firm uses to check what a client sees.
  const suppliedBase = typeof body?.baseId === "string" ? body.baseId.trim() : ""
  if (admin.status === "ok" && suppliedBase) {
    baseId = suppliedBase
    if (!/^app[A-Za-z0-9]{10,}$/.test(baseId)) {
      return NextResponse.json({ error: "A valid client base is required." }, { status: 400 })
    }
    // Only ever a base this firm actually has a client for. The shared API key
    // can reach more than that, and a mistyped id should fail rather than read
    // from somewhere unrelated.
    if (!(await isClientBase(baseId))) {
      return NextResponse.json({ error: "Unknown client base." }, { status: 400 })
    }
  } else {
    const client = await getPortalClient()
    if (!client?.clientBaseId) {
      return NextResponse.json({ error: "Not signed in." }, { status: 401 })
    }
    // The base is taken from the SESSION, never from the request. In admin
    // preview mode getPortalClient returns the previewed client, which is
    // exactly the base that page is showing.
    baseId = String(client.clientBaseId)
    // And the same gate the page uses. Without this a client could expand a
    // row that was deliberately kept off their Discovery page. Admins in
    // preview are held to it too, on purpose: the point of preview is to see
    // what the client sees.
    const allowed = await discoveryRecordAvailable(baseId, recordId)
    if (!allowed) {
      return NextResponse.json({ error: "That document isn't available." }, { status: 403 })
    }
  }

  const url = await discoveryRecordUrl(baseId, recordId)
  if (!url) {
    return NextResponse.json({ error: "That row has no link on it." }, { status: 404 })
  }

  const folderId = parseDriveFolderId(url)
  if (!folderId) {
    return NextResponse.json(
      { error: "That link isn't a Google Drive folder, so there's nothing to list." },
      { status: 400 }
    )
  }

  // Asked for explicitly by the Refresh control, so a folder that changed in
  // Drive can be re-read without waiting for the cache to lapse.
  const result = await summariseDriveFolder(folderId, { force: body?.refresh === true })
  if (!result.ok) {
    // 200 with a reason, not an error status: "this folder hasn't been shared
    // with the portal" is information for the person, not a fault to retry.
    return NextResponse.json({ ok: false, reason: result.error.reason, error: result.error.message })
  }
  return NextResponse.json({ ok: true, summary: result.summary })
}
