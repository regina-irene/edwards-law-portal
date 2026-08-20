// lib/blob-read.ts - read the bytes of a blob back on the server (2026-08-20).
//
// SERVER ONLY. Never import this into a client component: it uses the store
// token from the environment.
//
// WHY NOT JUST fetch(url)
// Browser uploads now land in the PRIVATE blob store, and a private blob URL is
// not publicly fetchable: a plain `fetch()` of it comes back unauthorised, not
// with the file. The bytes have to be read through the store SDK, which signs
// the request with the store token. `get()` takes a pathname rather than a URL,
// so the pathname is derived from the URL that was recorded with the row.
import { get } from "@vercel/blob"
import { blobAuth } from "@/lib/blob-token"

/**
 * Everything after the host, with no leading slash. Deliberately NOT decoded:
 * this has to match the pathname the routes store, which is derived from the
 * URL the same way.
 */
function pathnameFromUrl(url: string): string {
  return new URL(url).pathname.replace(/^\/+/, "")
}

/**
 * Pull a stored blob back into memory so it can be handed to Google Drive.
 *
 * Throws with a short reason. Callers turn that into a sentence for the person
 * rather than surfacing it, and should treat any throw as "the upload could not
 * be read", not as "the file is gone".
 */
export async function readBlobBytes(url: string): Promise<Buffer> {
  let pathname: string
  try {
    pathname = pathnameFromUrl(url)
  } catch {
    throw new Error("upload location is not a valid URL")
  }
  if (!pathname) throw new Error("upload location has no pathname")

  const result = await get(pathname, { ...blobAuth(), access: "private" })
  if (!result) throw new Error(`blob not found: ${pathname}`)
  if (result.statusCode < 200 || result.statusCode > 299) {
    throw new Error(`blob read returned ${result.statusCode}`)
  }
  if (!result.stream) throw new Error("blob read returned no body")

  // Same shape the [id] routes use to stream a blob out, just buffered here
  // because Drive wants the whole file.
  return Buffer.from(await new Response(result.stream).arrayBuffer())
}
