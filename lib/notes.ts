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
  // who wrote it; null on notes written before authors were recorded
  author_name: string | null
  author_email: string | null
}

export interface NoteAuthor {
  email: string
  name: string
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
    SELECT id, body, created_at, updated_at, author_name, author_email FROM client_notes
    WHERE client_id = ${String(clientId)}
    ORDER BY created_at DESC
  `
  return r.rows as ClientNote[]
}

export async function createNote(clientId: string, bodyHtml: string, author: NoteAuthor): Promise<ClientNote> {
  const body = sanitizeNotesHtml(bodyHtml)
  const r = await sql`
    INSERT INTO client_notes (client_id, body, body_text, author_email, author_name)
    VALUES (${String(clientId)}, ${body}, ${plainTextOf(body)}, ${author.email}, ${author.name})
    RETURNING id, body, created_at, updated_at, author_name, author_email
  `
  return r.rows[0] as ClientNote
}

export async function updateNote(id: string, bodyHtml: string): Promise<ClientNote | null> {
  const body = sanitizeNotesHtml(bodyHtml)
  const r = await sql`
    UPDATE client_notes
    SET body = ${body}, body_text = ${plainTextOf(body)}, updated_at = NOW()
    WHERE id = ${id}
    RETURNING id, body, created_at, updated_at, author_name, author_email
  `
  return (r.rows[0] as ClientNote) ?? null
}

export async function deleteNote(id: string): Promise<boolean> {
  const r = await sql`DELETE FROM client_notes WHERE id = ${id} RETURNING id`
  return r.rows.length > 0
}

export async function latestNoteByClient(): Promise<Map<string, { snippet: string; created_at: string; author_name: string | null }>> {
  const r = await sql`
    SELECT DISTINCT ON (client_id) client_id, body_text, created_at, author_name
    FROM client_notes
    ORDER BY client_id, created_at DESC
  `
  const map = new Map<string, { snippet: string; created_at: string; author_name: string | null }>()
  for (const row of r.rows) {
    const text = String(row.body_text ?? "")
    map.set(String(row.client_id), {
      snippet: text.length <= 140 ? text : text.slice(0, 140).trimEnd() + "…",
      created_at: String(row.created_at),
      author_name: row.author_name ? String(row.author_name) : null,
    })
  }
  return map
}

// Everyone who has ever written a note — the options for the "written by" filter.
export async function listNoteAuthors(): Promise<string[]> {
  const r = await sql`
    SELECT DISTINCT author_name FROM client_notes
    WHERE author_name IS NOT NULL AND author_name <> ''
    ORDER BY author_name
  `
  return r.rows.map((row) => String(row.author_name))
}

export interface NoteSearchHit {
  clientId: string
  noteId: string
  snippet: string
  created_at: string
  author_name: string | null
}

// Text search, author, and case filters — any combination. An empty query
// with a filter simply lists everything matching that filter.
export async function searchNotes(q: string, author = "", clientId = ""): Promise<NoteSearchHit[]> {
  const text = q.trim()
  const who = author.trim()
  const forCase = clientId.trim()
  const r = await sql`
    SELECT id, client_id, body_text, created_at, author_name FROM client_notes
    WHERE (${text} = '' OR body_text ILIKE ${"%" + text + "%"})
      AND (${who} = '' OR author_name = ${who})
      AND (${forCase} = '' OR client_id = ${forCase})
    ORDER BY created_at DESC
    LIMIT 50
  `
  return r.rows.map((row) => {
    const body = String(row.body_text ?? "")
    return {
      clientId: String(row.client_id),
      noteId: String(row.id),
      snippet: body.length <= 140 ? body : body.slice(0, 140).trimEnd() + "…",
      created_at: String(row.created_at),
      author_name: row.author_name ? String(row.author_name) : null,
    }
  })
}
