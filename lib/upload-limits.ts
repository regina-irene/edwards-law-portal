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

/**
 * Content types the firm accepts FROM CLIENTS.
 *
 * Family-law discovery is not just PDFs and Word files. Bank exports arrive as
 * .csv, correspondence as .eml or .msg, a production as a .zip, and evidence as
 * phone video. A list that stopped at "pdf, doc, jpg" turned those into an
 * upload the person could not complete and could not explain, so the list below
 * covers what actually turns up.
 *
 * The firm's own uploads are not filtered at all: see app/api/blob-upload.
 */
export const ACCEPTED_UPLOAD_TYPES = [
  // Documents
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/rtf",
  "text/rtf",
  "application/vnd.oasis.opendocument.text",
  // Spreadsheets and data exports
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.oasis.opendocument.spreadsheet",
  "text/csv",
  "application/csv",
  "text/plain",
  // Email
  "message/rfc822",
  "application/vnd.ms-outlook",
  // Archives
  "application/zip",
  "application/x-zip-compressed",
  // Images
  "image/jpeg",
  "image/png",
  "image/heic",
  "image/heif",
  "image/tiff",
  // Video
  "video/quicktime",
  "video/mp4",
]

/**
 * The same list as an `accept` attribute for a bare <input type="file">.
 *
 * Extensions are included alongside the media types because a browser reports
 * no useful type at all for .msg and often not for .eml or .heic, so an
 * accept list of media types alone would hide those files in the picker.
 * This only filters the dialog. The real check is the upload token.
 */
export const UPLOAD_ACCEPT_ATTR = [
  ...ACCEPTED_UPLOAD_TYPES,
  ".pdf",
  ".doc",
  ".docx",
  ".rtf",
  ".odt",
  ".ods",
  ".xls",
  ".xlsx",
  ".csv",
  ".txt",
  ".eml",
  ".msg",
  ".zip",
  ".jpg",
  ".jpeg",
  ".png",
  ".heic",
  ".heif",
  ".tif",
  ".tiff",
  ".mov",
  ".mp4",
].join(",")

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
