// lib/upload-limits.ts - one place for what "too big" means (2026-08-20).
//
// WHY THIS FILE EXISTS
// A client tried to send a document production on 2026-08-20 and got "Upload
// failed / Nothing was sent", which read as a connection problem. It was not.
// Vercel's runtime logs showed 413 from the platform itself: a serverless
// function rejects any REQUEST BODY over ~4.5 MB, and the request never
// reached our code. Meanwhile every screen in the portal promised 25 MB.
//
// Uploads now go from the browser STRAIGHT to Vercel Blob, which has no such
// ceiling, and the server fetches the stored blob to pass on to Drive. A
// response body is not a request body, so the 4.5 MB rule does not apply on
// that leg either.
//
// Keep these numbers here, not scattered through components, so the promise on
// screen and the check on the server can never drift apart again.

/** What the portal accepts and advertises. Blob itself allows far more. */
export const MAX_UPLOAD_BYTES = 100 * 1024 * 1024

export const MAX_UPLOAD_LABEL = "100 MB"

/**
 * The old ceiling, kept as a named constant purely so the reason is greppable:
 * anything larger than this CANNOT be sent through a normal API route body.
 * Nothing should post file bytes to a route handler any more.
 */
export const VERCEL_REQUEST_BODY_LIMIT_BYTES = 4.5 * 1024 * 1024

/** Content types the firm accepts from clients. */
export const ACCEPTED_UPLOAD_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/jpeg",
  "image/png",
  "image/heic",
  "image/heif",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
]

export function prettyBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

/** null when the file is fine, otherwise a sentence to show the person. */
export function tooBigMessage(file: { name: string; size: number }): string | null {
  if (file.size <= MAX_UPLOAD_BYTES) return null
  return `${file.name} is ${prettyBytes(file.size)}, over the ${MAX_UPLOAD_LABEL} limit.`
}
