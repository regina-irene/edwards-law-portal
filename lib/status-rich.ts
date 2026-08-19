// lib/status-rich.ts — formatting for the client-facing case status (2026-08-18).
//
// Airtable's rich text is Markdown, which has no colour or highlight, so the
// formatted version lives here and Airtable receives the plain text. The board
// stays perfectly readable; the portal gets bold, colour and highlighting.
//
// Airtable remains the source of truth for the WORDS. Each stored fragment
// carries a hash of the plain text it was generated from, so if the status is
// edited directly on the Airtable board the hash stops matching and the portal
// falls back to Airtable's text rather than showing formatting that no longer
// describes it. Same approach as the AI-formatted calendar notes.
import { createHash } from "crypto"
import { sql } from "@/lib/db"
import { sanitizeNotesHtml } from "@/lib/sanitize"
import { bodyToPlainText, plainToHtml } from "@/lib/message-format"

const KEY_PREFIX = "status_rich:"

export interface RichStatus {
  html: string
  /** Hash of the plain text this HTML was saved from. */
  hash: string
}

function keyFor(clientId: string): string {
  return KEY_PREFIX + String(clientId)
}

export function hashOf(plain: string): string {
  return createHash("sha256").update(plain.trim()).digest("hex").slice(0, 32)
}

/**
 * HTML → the plain text that goes to Airtable. Lists survive as "• " bullets.
 *
 * The `<p>` wrapper is load-bearing. bodyToPlainText only decodes entities when
 * it detects a real tag, and an unformatted one-line status is bare escaped
 * text with no tags at all — so "Smith &amp; Jones" would have gone into the
 * live base literally, ampersand-a-m-p and all, and re-escaped on every
 * subsequent save. Forcing the HTML branch decodes it properly.
 */
export function statusHtmlToPlain(html: string): string {
  return bodyToPlainText(`<p>${html}</p>`)
}

export async function getRichStatus(clientId: string): Promise<RichStatus | null> {
  try {
    const r = await sql`SELECT value FROM app_settings WHERE key = ${keyFor(clientId)} LIMIT 1`
    const raw = r.rows[0]?.value
    if (!raw) return null
    const parsed: unknown = JSON.parse(String(raw))
    if (!parsed || typeof parsed !== "object") return null
    const { html, hash } = parsed as Partial<RichStatus>
    if (typeof html !== "string" || typeof hash !== "string") return null
    return { html, hash }
  } catch {
    return null
  }
}

/** One query for the whole board rather than one per row. Fails soft to empty. */
export async function getRichStatuses(clientIds: string[]): Promise<Map<string, RichStatus>> {
  const out = new Map<string, RichStatus>()
  if (clientIds.length === 0) return out
  try {
    const keys = clientIds.map(keyFor)
    const r = await sql.query("SELECT key, value FROM app_settings WHERE key = ANY($1)", [keys])
    for (const row of r.rows) {
      try {
        const parsed = JSON.parse(String(row.value)) as Partial<RichStatus>
        if (typeof parsed.html === "string" && typeof parsed.hash === "string") {
          out.set(String(row.key).slice(KEY_PREFIX.length), { html: parsed.html, hash: parsed.hash })
        }
      } catch {
        // one bad row shouldn't cost the rest their formatting
      }
    }
  } catch {
    // fail soft — the board renders plain text
  }
  return out
}

/** Store the formatted version against the plain text that went to Airtable. */
export async function saveRichStatus(clientId: string, html: string, plain: string): Promise<void> {
  try {
    const clean = sanitizeNotesHtml(html)
    const payload = JSON.stringify({ html: clean, hash: hashOf(plain) })
    await sql`
      INSERT INTO app_settings (key, value, updated_at)
      VALUES (${keyFor(clientId)}, ${payload}, now())
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()
    `
  } catch {
    // The status itself is already saved to Airtable; losing the formatting is
    // a cosmetic failure, not a data one.
  }
}

/**
 * The HTML to render for a client's status.
 *
 * Returns the stored formatting when it still matches what Airtable holds, and
 * otherwise the Airtable text escaped into simple HTML — so a status edited on
 * the board shows the board's words, never stale formatting over new text.
 */
export async function resolveStatusHtml(clientId: string, airtableText: string): Promise<string> {
  const text = (airtableText ?? "").trim()
  if (!text) return ""
  const stored = await getRichStatus(clientId)
  if (stored && stored.hash === hashOf(text)) return sanitizeNotesHtml(stored.html)
  return plainToHtml(text)
}
