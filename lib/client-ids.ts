// lib/client-ids.ts - two small readers of the Clients board's text fields
// (2026-09-04).
//
// Deliberately its own file with NO imports. They started life in lib/airtable,
// which pulls in next/cache, which in turn needs Next's server internals - so a
// plain unit test of a string function could not even load the module
// ("TextEncoder is not defined"). Pure helpers with no dependencies can be
// tested directly. lib/airtable re-exports both, so existing callers are
// unaffected.

/**
 * The bare base id, from whatever got pasted into "Client Base ID".
 *
 * Airtable's own URLs look like
 *   https://airtable.com/appPtZHlmuCllLk4i/tblivNbyTFXiNPzkx/viwXXXX
 * so copying "the base" out of the address bar very easily yields
 * "appPtZHlmuCllLk4i/tblivNbyTFXiNPzkx" or the whole URL. That is what
 * happened on the Edwards, Regina record (2026-09-04), and the failure was
 * horrible to read from the outside: every board built a URL of the form
 *   /v0/appXXX/tblYYY/Correspondence
 * which Airtable rejects, so the client's Correspondence page said "We couldn't
 * load this information right now" and the new-document automation quietly
 * skipped her, because an unreadable board is deliberately treated as "do
 * nothing" rather than "no documents".
 *
 * Taking the first app-shaped segment fixes every one of those pages at once,
 * and means the next person to paste a URL never sees the problem at all.
 */
export function normalizeBaseId(raw: unknown): string {
  const s = typeof raw === "string" ? raw.trim() : ""
  if (!s) return ""
  const m = s.match(/\bapp[A-Za-z0-9]{14}\b/)
  // Anything unrecognisable is handed back as-is: it reads better in an error
  // message than an empty string does.
  return m ? m[0] : s
}

/**
 * The client's first name, for greeting them by it.
 *
 * The Clients board is meant to hold "Lastname | Firstname", but not every row
 * follows it - "Edwards, Regina" uses a comma. Splitting only on the pipe gave
 * those clients an email that opened "Hello," instead of "Dear Regina", which
 * reads like a mail merge that went wrong. Returns "" when there is no second
 * part, and every caller falls back to a plain greeting.
 */
export function clientFirstName(name: string): string {
  const raw = (name ?? "").trim()
  if (!raw) return ""
  const parts = raw.split(/[|,]/).map((p) => p.trim()).filter(Boolean)
  return parts.length > 1 ? parts[1] : ""
}
