// lib/blob-token.ts - find the Vercel Blob read/write token, whatever it is
// called (2026-08-20).
//
// WHY THIS EXISTS
// An upload failed in production with:
//   "Vercel Blob: No read-write token found. Either configure the
//    BLOB_READ_WRITE_TOKEN environment variable, or pass a `token` option"
// even though a Blob store WAS connected to the project.
//
// The SDK only ever looks for the exact name `BLOB_READ_WRITE_TOKEN`. Vercel
// does not always create it under that name:
//   - connecting a store with an environment-variable PREFIX produces
//     `MYPREFIX_BLOB_READ_WRITE_TOKEN`
//   - a second store in the same project is prefixed to avoid a collision
//   - the variable may exist for Preview and Development but not Production
//
// So rather than depending on one hard-coded name, look for the canonical one
// first and otherwise take any variable whose name ends with
// BLOB_READ_WRITE_TOKEN. The result is passed explicitly to every Blob call as
// the `token` option, which the SDK honours ahead of its own lookup.
//
// The last case (missing in Production) cannot be fixed from code: connect the
// store to the Production environment and redeploy.

let cached: string | null | undefined

/**
 * The token, or null when there genuinely isn't one.
 *
 * Resolved once per process. Returns null rather than throwing so a caller can
 * produce its own sentence for the person, instead of surfacing an SDK error.
 */
export function blobToken(): string | null {
  if (cached !== undefined) return cached

  const direct = process.env.BLOB_READ_WRITE_TOKEN
  if (direct) {
    cached = direct
    return cached
  }

  // Any prefixed variant, e.g. EFL_BLOB_READ_WRITE_TOKEN.
  for (const [name, value] of Object.entries(process.env)) {
    if (value && name.endsWith("BLOB_READ_WRITE_TOKEN")) {
      // Name only, never the value.
      console.log(`[blob-token] using ${name} (BLOB_READ_WRITE_TOKEN is not set)`)
      cached = value
      return cached
    }
  }

  cached = null
  return cached
}

/** True when Blob is usable at all. Lets a route fail with a real sentence. */
export function blobConfigured(): boolean {
  return blobToken() !== null
}

/**
 * Spread into any @vercel/blob call: `put(path, body, { ...blobAuth(), ... })`.
 * Omits the key entirely when there is no token, so the SDK falls back to its
 * own lookup and its own error rather than being handed `undefined`.
 */
export function blobAuth(): { token?: string } {
  const t = blobToken()
  return t ? { token: t } : {}
}
