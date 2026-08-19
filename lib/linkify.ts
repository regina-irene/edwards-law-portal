// lib/linkify.ts - turn bare URLs into real links (2026-08-18).
//
// A case link pasted into a status update, a Drive URL in an Airtable field, a
// court's e-filing address in a field note: all of them arrived as plain text
// that a client had to select and copy by hand. Anywhere the portal shows text
// that might contain a URL, it runs through here.
//
// Pure string work, no imports, so this is safe in server and client
// components alike.

// Bare URLs and www-style hosts. Deliberately conservative: a scheme or a
// leading "www." is required, so "e.g. see paragraph 4.2" is never mangled.
const URL_RE = /\b(https?:\/\/[^\s<>"']+|www\.[^\s<>"']+)/gi

// Trailing punctuation belongs to the sentence, not the address:
// "see https://x.com/a." should link the URL and leave the full stop behind.
const TRAILING = /[.,;:!?)\]}>'"]+$/

export function isUrlLike(text: string): boolean {
  const t = text.trim()
  if (!t || /\s/.test(t)) return false
  return /^(https?:\/\/|www\.)\S+$/i.test(t) || /^mailto:\S+$/i.test(t)
}

/** Add the scheme a bare "www.x.com" needs to be a working href. */
export function hrefFor(raw: string): string {
  const t = raw.trim()
  if (/^(https?:\/\/|mailto:|tel:)/i.test(t)) return t
  return `https://${t}`
}

/** "https://drive.google.com/file/d/1AbC…/view" -> "drive.google.com/file/…" */
export function shortenUrl(raw: string, max = 48): string {
  const trimmed = raw.trim().replace(/^https?:\/\//i, "").replace(/\/$/, "")
  return trimmed.length <= max ? trimmed : `${trimmed.slice(0, max - 1)}…`
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
}

/**
 * Link the bare URLs in an HTML fragment, leaving existing markup alone.
 *
 * Walks tag by tag rather than running a regex over the whole string, so:
 *   - text inside an existing <a> is never re-linked (no nested anchors)
 *   - attribute values are never touched, so an href can't be corrupted
 *   - tag names and structure pass through untouched
 *
 * The input is expected to have been sanitized already; this only adds anchors.
 */
export function linkifyHtml(html: string): string {
  if (!html || !/https?:\/\/|www\./i.test(html)) return html

  const parts = html.split(/(<[^>]*>)/)
  let depth = 0 // how deep we are inside <a> elements
  return parts
    .map((part) => {
      if (part.startsWith("<")) {
        const tag = part.toLowerCase()
        if (/^<a[\s>]/.test(tag)) depth++
        else if (/^<\/a\s*>/.test(tag)) depth = Math.max(0, depth - 1)
        return part
      }
      if (depth > 0 || !part) return part
      return part.replace(URL_RE, (match) => {
        const trailing = match.match(TRAILING)?.[0] ?? ""
        const url = trailing ? match.slice(0, -trailing.length) : match
        if (!url) return match
        return (
          `<a href="${escapeHtml(hrefFor(url))}" target="_blank" rel="noopener noreferrer">` +
          `${escapeHtml(url)}</a>${escapeHtml(trailing)}`
        )
      })
    })
    .join("")
}
