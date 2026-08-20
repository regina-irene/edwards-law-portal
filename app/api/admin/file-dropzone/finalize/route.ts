// app/api/admin/file-dropzone/finalize/route.ts - the second half of a firm
// upload to the shared Drive folder (2026-08-20).
//
// The browser has already put the file in Vercel Blob. This route takes the blob
// URL (a few hundred bytes of JSON, so nowhere near the 4.5 MB request body
// limit that broke the old direct upload), fetches those bytes server-side,
// hands them to Google Drive, and deletes the temporary blob.
//
// Fetching the blob is a RESPONSE body, which has no such limit, so a large
// scanned production is fine here where it was impossible before.
//
// Nothing but Drive holds this file afterwards: there is no database row
// pointing at the blob, so the blob is deleted the way the client finalize route
// deletes its own.
import { NextResponse } from "next/server"
import { del } from "@vercel/blob"
import { requireAdmin } from "@/lib/admin"
import { sql } from "@/lib/db"
import { uploadToDrive } from "@/lib/google-drive"

export const runtime = "nodejs"
// Pulling a large file out of Blob and pushing it to Drive takes longer than a
// default invocation allows.
export const maxDuration = 300

// Only ever fetch from Blob storage. Without this the route would be an open
// proxy that fetches any URL the caller names.
const BLOB_URL_RE = /^https:\/\/[a-z0-9-]+\.public\.blob\.vercel-storage\.com\//i

interface Body {
  url?: unknown
  fileName?: unknown
  contentType?: unknown
  folderId?: unknown
}

export async function POST(req: Request): Promise<NextResponse> {
  const check = await requireAdmin()
  if (check.status !== "ok") {
    return NextResponse.json({ error: "Please sign in to the firm side again." }, { status: 401 })
  }

  const body = (await req.json().catch(() => null)) as Body | null
  const url = typeof body?.url === "string" ? body.url : ""
  const fileName = typeof body?.fileName === "string" ? body.fileName.trim() : ""
  const contentType = typeof body?.contentType === "string" ? body.contentType : ""
  const folderOverride = typeof body?.folderId === "string" ? body.folderId.trim() : ""

  if (!url || !fileName) {
    return NextResponse.json({ error: "Missing upload details." }, { status: 400 })
  }
  if (!BLOB_URL_RE.test(url)) {
    return NextResponse.json({ error: "Unrecognised upload location." }, { status: 400 })
  }

  const folderId =
    folderOverride ||
    process.env.MESSAGE_DOCS_DRIVE_FOLDER_ID ||
    process.env.ROOT_DRIVE_FOLDER_ID ||
    ""

  if (!process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    return NextResponse.json(
      { error: "Google Drive isn't connected yet (service account key missing)." },
      { status: 503 }
    )
  }
  if (!folderId) {
    return NextResponse.json({ error: "No Drive folder configured." }, { status: 503 })
  }

  try {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`blob fetch ${res.status}`)
    const buffer = Buffer.from(await res.arrayBuffer())

    const result = await uploadToDrive(buffer, fileName, contentType, folderId)
    await sql`
      INSERT INTO dropzone_files (file_name, pathname, url, drive_status, uploaded_by)
      VALUES (${fileName}, ${"drive:" + (result.id ?? "")}, ${result.link ?? ""}, 'delivered', ${check.email})
    `.catch(() => {})

    // The blob was a staging area, not storage. Losing this is harmless, so it
    // must not fail the upload the person is waiting on.
    try {
      await del(url)
    } catch (e) {
      console.error("[admin file-dropzone] blob cleanup failed:", e instanceof Error ? e.message : e)
    }

    return NextResponse.json({ ok: true, link: result.link ?? null })
  } catch (e) {
    console.error("[admin file-dropzone] drive upload failed:", e instanceof Error ? e.message : e)
    return NextResponse.json(
      { error: "Upload to Drive failed. Check the folder and the service account, then try again." },
      { status: 502 }
    )
  }
}
