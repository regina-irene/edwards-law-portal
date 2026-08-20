// app/api/file-dropzone/finalize/route.ts - the second half of a client upload
// (2026-08-20).
//
// The browser has already put the file in Vercel Blob. This route takes the
// blob URL (a few hundred bytes of JSON, so nowhere near the 4.5 MB request
// body limit that broke the old direct upload), reads those bytes server-side,
// hands them to Google Drive, writes the receipt into the conversation, and
// deletes the temporary blob.
//
// Reading the blob is a RESPONSE body, which has no such limit, so a 60 MB
// production PDF is fine here where it was impossible before. It goes through
// the store SDK rather than fetch(): the blob is private and its URL is not
// publicly fetchable. See lib/blob-read.
import { NextResponse } from "next/server"
import { del } from "@vercel/blob"
import { assertClientCanWrite } from "@/lib/client-write-guard"
import { deliverClientUpload, driveConfigured } from "@/lib/client-uploads"
import { readBlobBytes } from "@/lib/blob-read"
import { blobAuth } from "@/lib/blob-token"
import { recordUploadReceipt } from "@/lib/upload-receipt"

export const runtime = "nodejs"
// Pulling a large file out of Blob and pushing it to Drive takes longer than a
// default invocation allows.
export const maxDuration = 300

interface Body {
  url?: unknown
  fileName?: unknown
  relativePath?: unknown
  contentType?: unknown
}

export async function POST(req: Request): Promise<NextResponse> {
  const gate = await assertClientCanWrite()
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status })
  const client = gate.client

  const body = (await req.json().catch(() => null)) as Body | null
  const url = typeof body?.url === "string" ? body.url : ""
  const fileName = typeof body?.fileName === "string" ? body.fileName.trim() : ""
  const contentType = typeof body?.contentType === "string" ? body.contentType : ""
  const rawPath = typeof body?.relativePath === "string" ? body.relativePath : fileName

  if (!url || !fileName) {
    return NextResponse.json({ error: "Missing upload details." }, { status: 400 })
  }
  // Only ever read from Blob storage. Without this the route would be an open
  // proxy that reads any URL the caller names.
  if (!/^https:\/\/[a-z0-9-]+\.(public|private)\.blob\.vercel-storage\.com\//i.test(url)) {
    return NextResponse.json({ error: "Unrecognised upload location." }, { status: 400 })
  }

  if (!driveConfigured() || !process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    return NextResponse.json(
      { error: "File uploads aren't connected yet. Please email your documents for now." },
      { status: 503 }
    )
  }

  // "folder/sub/name.pdf" when the file came from a dropped folder.
  const segments = rawPath.split("/").map((s) => s.trim()).filter(Boolean)
  const baseName = segments.pop() || fileName

  try {
    const buffer = await readBlobBytes(url)

    const { delivered, link } = await deliverClientUpload({
      clientId: String(client.clientId),
      fileName: baseName,
      buffer,
      mimeType: contentType || null,
      subPath: segments,
    })
    if (!delivered) {
      return NextResponse.json(
        { error: "We couldn't file that with your legal team. Please try again." },
        { status: 502 }
      )
    }

    // Fail-soft: the file is with the firm either way, so a database problem
    // must never turn a good upload into an error for the client.
    try {
      await recordUploadReceipt(String(client.clientId), baseName)
    } catch (e) {
      console.error("[finalize] upload receipt failed:", e instanceof Error ? e.message : e)
    }

    // The blob was a staging area, not storage. Losing this is harmless, so it
    // must not fail the upload the client is waiting on.
    try {
      await del(url, { ...blobAuth() })
    } catch (e) {
      console.error("[finalize] blob cleanup failed:", e instanceof Error ? e.message : e)
    }

    return NextResponse.json({ ok: true, link })
  } catch (e) {
    console.error("[finalize] delivery failed:", e instanceof Error ? e.message : e)
    return NextResponse.json(
      { error: "We couldn't file that with your legal team. Please try again." },
      { status: 502 }
    )
  }
}
