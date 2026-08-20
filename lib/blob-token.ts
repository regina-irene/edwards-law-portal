// lib/blob-token.ts - work out how this deployment is allowed to talk to
// Vercel Blob, and say so plainly when it is not (2026-08-20).
//
// WHY THIS EXISTS
// Uploads failed in production with "Vercel Blob: Failed to retrieve the client
// token" even though a Blob store WAS connected to the project. The project's
// environment turned out to hold BLOB_STORE_ID and BLOB_WEBHOOK_PUBLIC_KEY and
// no BLOB_READ_WRITE_TOKEN at all, which is not a broken setup: it is Vercel's
// OIDC-based Blob auth.
//
// @vercel/blob 2.4.0 accepts TWO sets of credentials, and they are not
// interchangeable:
//
//   1. A read-write token, from `BLOB_READ_WRITE_TOKEN` or an explicit `token`
//      option. Works for everything.
//   2. OIDC: a short-lived `VERCEL_OIDC_TOKEN` that Vercel injects at runtime,
//      PLUS a store id from `BLOB_STORE_ID`. Works for server-side calls only.
//
// The distinction that matters here: `handleUpload`, which mints the token the
// BROWSER uses to upload straight to Blob, calls the SDK's read-write-only
// resolver and derives the store id by parsing the read-write token itself. It
// has no OIDC path. So a project on OIDC alone can read, write and delete blobs
// from the server, and cannot issue a single client upload token.
//
// That is why the two checks below are separate, and why only one of them can
// be satisfied from code. If client uploads are refused, a read-write token has
// to be added to the project's Production environment; nothing here can
// substitute for it.

let cachedToken: string | null | undefined

/**
 * A read-write token, or null when there genuinely isn't one.
 *
 * Resolved once per process. Returns null rather than throwing so a caller can
 * produce its own sentence for the person instead of surfacing an SDK error.
 */
export function blobToken(): string | null {
  if (cachedToken !== undefined) return cachedToken

  const direct = process.env.BLOB_READ_WRITE_TOKEN
  if (direct) {
    cachedToken = direct
    return cachedToken
  }

  // Connecting a store with an environment-variable prefix, or connecting a
  // second store, produces a prefixed name such as EFL_BLOB_READ_WRITE_TOKEN.
  // The SDK only ever looks for the exact name, so find it ourselves and pass
  // it explicitly.
  for (const [name, value] of Object.entries(process.env)) {
    if (value && name.endsWith("BLOB_READ_WRITE_TOKEN")) {
      // Name only, never the value.
      console.log(`[blob-token] using ${name} (BLOB_READ_WRITE_TOKEN is not set)`)
      cachedToken = value
      return cachedToken
    }
  }

  cachedToken = null
  return cachedToken
}

/** The store id Vercel provisions alongside OIDC Blob auth. */
export function blobStoreId(): string | null {
  return process.env.BLOB_STORE_ID || null
}

/**
 * True when this deployment can reach Blob from the SERVER: put, get, del.
 * Either credential set will do, so a project on OIDC alone still passes.
 */
export function blobConfigured(): boolean {
  return blobToken() !== null || blobStoreId() !== null
}

/**
 * True when this deployment can mint upload tokens for the BROWSER.
 *
 * Deliberately stricter than blobConfigured(). `handleUpload` has no OIDC path,
 * so this is a read-write token or nothing.
 */
export function blobClientUploadsConfigured(): boolean {
  return blobToken() !== null
}

/** One sentence naming what is actually missing, for the server log. */
export function blobCredentialSummary(): string {
  if (blobToken()) return "read-write token present"
  if (blobStoreId()) {
    return (
      "OIDC only: BLOB_STORE_ID is set but no BLOB_READ_WRITE_TOKEN. Server-side blob calls " +
      "work; browser upload tokens cannot be issued. Add a read-write token to this " +
      "environment and redeploy."
    )
  }
  return "no blob credentials at all: neither BLOB_READ_WRITE_TOKEN nor BLOB_STORE_ID is set"
}

/**
 * Spread into any @vercel/blob call: `put(path, body, { ...blobAuth(), ... })`.
 *
 * Omits the key entirely when there is no read-write token, so the SDK falls
 * back to its own resolution - which is what picks up OIDC. Handing it an
 * explicit `undefined` would not.
 */
export function blobAuth(): { token?: string } {
  const t = blobToken()
  return t ? { token: t } : {}
}
