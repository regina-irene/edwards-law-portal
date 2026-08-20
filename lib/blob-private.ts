// lib/blob-private.ts - move a browser upload out of public staging and into
// private storage (2026-08-20).
//
// WHY
// Direct-to-Blob uploads solved the 4.5 MB request-body limit that was making
// client uploads fail. But a browser upload token can only mint a PUBLIC blob,
// and message and task attachments are kept long-term and served later through
// an authorised route. Leaving them public would mean a client's financial
// affidavit sat behind nothing but an unguessable URL: forwarded, logged by a
// proxy, or left in browser history, it would be readable by anyone.
//
// So the public blob is treated strictly as a staging area. The server reads it
// once, writes the bytes back privately, and deletes the staging copy. What
// gets stored in the database is the PRIVATE url.
//
// The dropzone routes don't need this: they hand the bytes to Google Drive and
// delete the staging blob in the same request, so nothing public persists.
import { put, del } from "@vercel/blob"

export interface PrivateBlob {
  url: string
  pathname: string
  /** The bytes, so a caller that also needs them (Drive) doesn't refetch. */
  buffer: Buffer
}

/**
 * Fetch a public staging blob, store it privately, and remove the public copy.
 *
 * Throws if the staging blob can't be read. The caller should treat that as
 * "the upload didn't land" and tell the person to try again, rather than
 * writing a database row that points at nothing.
 */
export async function moveToPrivateBlob(opts: {
  stagingUrl: string
  pathname: string
  contentType?: string | null
}): Promise<PrivateBlob> {
  const res = await fetch(opts.stagingUrl)
  if (!res.ok) throw new Error(`staging blob fetch ${res.status}`)
  const buffer = Buffer.from(await res.arrayBuffer())

  // The staging pathname already carries a random suffix, so reuse it as-is
  // rather than adding a second one.
  const stored = await put(opts.pathname, buffer, {
    access: "private",
    contentType: opts.contentType || undefined,
    addRandomSuffix: false,
  })

  // Best effort: a leftover staging blob is untidy and slightly exposed, but it
  // must not fail an upload that has already been stored safely.
  try {
    await del(opts.stagingUrl)
  } catch (e) {
    console.error("[blob-private] staging cleanup failed:", e instanceof Error ? e.message : e)
  }

  return { url: stored.url, pathname: stored.pathname, buffer }
}
