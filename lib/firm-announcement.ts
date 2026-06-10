// lib/firm-announcement.ts — the firm-wide announcement (FileFlow style):
// one rich-HTML banner shown across the top of the admin area and the client
// portal. Stored as a special page_content row (client_id '_global',
// page '_firm_announcement').
import { sql } from "@/lib/db"
import { sanitizeNotesHtml } from "@/lib/sanitize"

export async function getFirmAnnouncement(): Promise<string> {
  try {
    const r = await sql`
      SELECT announcement FROM page_content
      WHERE client_id = '_global' AND page = '_firm_announcement' LIMIT 1
    `
    return (r.rows[0]?.announcement ?? "").trim()
  } catch {
    return ""
  }
}

export async function saveFirmAnnouncement(html: string): Promise<void> {
  const clean = sanitizeNotesHtml(html)
  await sql`
    INSERT INTO page_content (client_id, page, announcement)
    VALUES ('_global', '_firm_announcement', ${clean})
    ON CONFLICT (client_id, page)
    DO UPDATE SET announcement = EXCLUDED.announcement
  `
}
