// lib/notes.ts — Field Notes storage: Regina's private per-client case log.
// Admin-only by construction: only /api/admin/notes and /admin/notes pages
// import this. HTML is sanitized on write; body_text is a plain-text shadow
// kept in sync for search and snippets.
import { sql } from "@/lib/db"
import { sanitizeNotesHtml } from "@/lib/sanitize"

export interface ClientNote {
  id: string
  body: string
  created_at: string
  updated_at: string | null
}

export function plainTextOf(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim()
}

export function snippetOf(html: string, max = 140): string {
  const text = plainTextOf(html)
  return text.length <= max ? text : text.slice(0, max).trimEnd() + "…"
}

export async function listNotes(clientId: string): Promise<ClientNote[]> {
  const r = await sql`
    SELECT id, body, created_at, updated_at FROM client_notes
    WHERE client_id = ${String(clientId)}
    ORDER BY created_at DESC
  `
  return r.rows as ClientNote[]
}

export async function createNote(clientId: string, bodyHtml: string): Promise<ClientNote> {
  const body = sanitizeNotesHtml(bodyHtml)
  const r = await sql`
    INSERT INTO client_notes (client_id, body, body_text)
    VALUES (${String(clientId)}, ${body}, ${plainTextOf(body)})
    RETURNING id, body, created_at, updated_at
  `
  return r.rows[0] as ClientNote
}

export async function updateNote(id: string, bodyHtml: string): Promise<ClientNote | null> {
  const body = sanitizeNotesHtml(bodyHtml)
  const r = await sql`
    UPDATE client_notes
    SET body = ${body}, body_text = ${plainTextOf(body)}, updated_at = NOW()
    WHERE id = ${id}
    RETURNING id, body, created_at, updated_at
  `
  return (r.rows[0] as ClientNote) ?? null
}

export async function deleteNote(id: string): Promise<boolean> {
  const r = await sql`DELETE FROM client_notes WHERE id = ${id} RETURNING id`
  return r.rows.length > 0
}

export async function latestNoteByClient(): Promise<Map<string, { snippet: string; created_at: string }>> {
  const r = await sql`
    SELECT DISTINCT ON (client_id) client_id, body_text, created_at
    FROM client_notes
    ORDER BY client_id, created_at DESC
  `
  const map = new Map<string, { snippet: string; created_at: string }>()
  for (const row of r.rows) {
    const text = String(row.body_text ?? "")
    map.set(String(row.client_id), {
      snippet: text.length <= 140 ? text : text.slice(0, 140).trimEnd() + "…",
      created_at: String(row.created_at),
    })
  }
  return map
}

export async function searchNotes(q: string): Promise<{ clientId: string; noteId: string; snippet: string; created_at: string }[]> {
  const r = await sql`
    SELECT id, client_id, body_text, created_at FROM client_notes
    WHERE body_text ILIKE ${"%" + q + "%"}
    ORDER BY created_at DESC
    LIMIT 50
  `
  return r.rows.map((row) => {
    const text = String(row.body_text ?? "")
    return {
      clientId: String(row.client_id),
      noteId: String(row.id),
      snippet: text.length <= 140 ? text : text.slice(0, 140).trimEnd() + "…",
      created_at: String(row.created_at),
    }
  })
}
