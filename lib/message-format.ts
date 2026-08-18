// lib/message-format.ts — message bodies come in two shapes (2026-08-18).
//
// Historically every chat_messages.body was plain text with newlines. Firm
// replies composed in formatting mode are now stored as HTML instead. There is
// no column saying which is which, so we sniff the content: a body counts as
// HTML only when it contains a real tag we actually emit. That deliberately
// does NOT match things a person might type, like "<3" or "a < b".
//
// Client-sent messages (portal and inbound SMS) are always plain text.

const HTML_TAG =
  /<(?:p|br|div|ul|ol|li|b|strong|i|em|u|s|strike|a|h2|h3|span|blockquote|img|font)\b[^>]*>/i

export function isHtmlBody(body: string): boolean {
  return HTML_TAG.test(body)
}

export function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}

/** Plain text with newlines → HTML with real <br> elements. */
export function plainToHtml(text: string): string {
  return escapeHtml(text).replace(/\r?\n/g, "<br>")
}

/** Any body → HTML, for the clipboard, printing and email. */
export function bodyToHtml(body: string): string {
  return isHtmlBody(body) ? body : plainToHtml(body)
}

/**
 * Any body → plain text. Used for SMS (texts carry no formatting), the .txt
 * export, and the plain flavor of the clipboard. Block-level tags become line
 * breaks and list items get a bullet, so the shape of the message survives.
 */
export function bodyToPlainText(body: string): string {
  if (!isHtmlBody(body)) return body
  let t = body
  t = t.replace(/<\s*br\s*\/?>/gi, "\n")
  t = t.replace(/<\s*li[^>]*>/gi, "\n• ")
  t = t.replace(/<\/\s*(p|div|h2|h3|li|ul|ol|blockquote)\s*>/gi, "\n")
  t = t.replace(/<[^>]+>/g, "")
  t = t
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
  // Collapse the runs of blank lines the tag stripping leaves behind.
  return t.replace(/\n{3,}/g, "\n\n").replace(/[ \t]+\n/g, "\n").trim()
}

/** True when a rich-text composer holds nothing worth sending. */
export function isEmptyRich(html: string): boolean {
  return bodyToPlainText(html).replace(/\s| /g, "") === "" && !/<img\b/i.test(html)
}
