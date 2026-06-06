// Conservative allowlist-ish sanitizer for admin-authored task notes (HTML).
// Notes are only written by authenticated admins (trusted), so this is
// defense-in-depth: strip scripts/styles, event handlers, and javascript: URLs.
export function sanitizeNotesHtml(input: unknown): string {
  if (typeof input !== "string" || !input) return ""
  let html = input
  // Remove dangerous element blocks entirely
  html = html.replace(/<(script|style)[\s\S]*?<\/\1>/gi, "")
  html = html.replace(/<\/?(script|style|iframe|object|embed|link|meta|form|input|button)[^>]*>/gi, "")
  // Remove inline event handlers (onclick=, onerror=, ...)
  html = html.replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
  // Neutralize javascript:/data: in href/src
  html = html.replace(/(href|src)\s*=\s*("|')\s*(javascript|data):[^"']*("|')/gi, '$1="#"')
  return html.slice(0, 20000)
}
