// lib/blob-upload-client.ts - browser-side upload helper (2026-08-20).
//
// Every upload in the portal used to POST the file into an API route. Vercel
// caps a serverless request body at ~4.5 MB, so anything larger came back as a
// bare 413 from the platform before our code ran. The person saw "Upload
// failed" and was told to check their connection.
//
// Now the browser hands the bytes straight to Vercel Blob, which has no such
// ceiling, and only the resulting URL is posted to the server.
//
// Browser only. Never import this into a server component or a route handler.
import { upload } from "@vercel/blob/client"
import { tooBigMessage } from "@/lib/upload-limits"

export type UploadScope = "client-upload" | "message" | "task" | "admin-upload"

export interface BlobUploadResult {
  url: string
  pathname: string
  contentType: string
}

/**
 * Put one file in Blob and return where it landed.
 *
 * `pathnamePrefix` must match what /api/blob-upload will authorise for this
 * user. A client's token is only valid under `uploads/`, so client uploads are
 * given prefixes like `uploads/` or `uploads/tasks/<taskId>`. Nothing here puts
 * a client id in the path, and nothing server-side reads one out of it:
 * ownership is always re-derived from the session by the route that records or
 * files the upload. The prefix is a scoping check, not an identity.
 *
 * The blob is written PRIVATE. A message or task attachment is kept and served
 * later through an authorised route, and an unguessable URL is not access
 * control for a client's financial affidavit.
 *
 * Throws with a human sentence. Callers show it as-is.
 */
export async function uploadToBlob(
  file: File,
  opts: {
    scope: UploadScope
    pathnamePrefix: string
    onProgress?: (percent: number) => void
  }
): Promise<BlobUploadResult> {
  const tooBig = tooBigMessage(file)
  if (tooBig) throw new Error(tooBig)

  const safe = file.name.replace(/[^\w.\-]+/g, "_") || "file"
  const prefix = opts.pathnamePrefix.replace(/\/+$/, "")

  const blob = await upload(`${prefix}/${safe}`, file, {
    access: "private",
    handleUploadUrl: "/api/blob-upload",
    contentType: file.type || undefined,
    clientPayload: JSON.stringify({ scope: opts.scope }),
    onUploadProgress: opts.onProgress
      ? (p: { percentage: number }) => opts.onProgress!(p.percentage)
      : undefined,
  })

  return {
    url: blob.url,
    pathname: blob.pathname,
    contentType: file.type || "application/octet-stream",
  }
}

/**
 * The full client-side journey for a document a client is sending the firm:
 * into Blob, then ask the server to file it with Drive.
 *
 * `relativePath` carries the folder structure when a whole folder was dropped.
 */
export async function sendFileToFirm(
  file: File,
  opts: { relativePath?: string; onProgress?: (percent: number) => void } = {}
): Promise<{ link: string | null }> {
  // No client id in the path on purpose: the browser doesn't know it, and the
  // finalize route takes it from the session rather than from anything sent
  // here. Blob is a staging area that is deleted once Drive has the file.
  const blob = await uploadToBlob(file, {
    scope: "client-upload",
    pathnamePrefix: "uploads",
    onProgress: opts.onProgress,
  })

  const res = await fetch("/api/file-dropzone/finalize", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url: blob.url,
      fileName: file.name,
      relativePath: opts.relativePath || file.name,
      contentType: blob.contentType,
    }),
  }).catch(() => null)

  if (!res?.ok) {
    const data = (await res?.json().catch(() => null)) as { error?: string } | null
    throw new Error(data?.error || "We couldn't file that with your legal team. Please try again.")
  }
  const data = (await res.json().catch(() => null)) as { link?: string | null } | null
  return { link: data?.link ?? null }
}
