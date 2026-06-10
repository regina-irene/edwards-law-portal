// lib/event-notes-ai.ts — uses Claude to reformat messy Google-Calendar event
// notes (court Zoom-rules walls of text) into clean, highlighted HTML for the
// client portal. Results are cached in Postgres keyed by event id + a hash of
// the source text, so each note is formatted ONCE, not per page view.
import { createHash } from "crypto"
import Anthropic from "@anthropic-ai/sdk"
import { sql } from "@/lib/db"
import { sanitizeNotesHtml } from "@/lib/sanitize"
import type { CaseEvent } from "@/lib/calendar"

// Notes shorter than this read fine as plain text — don't spend AI on them.
const MIN_LENGTH = 220
// Cap how many UNCACHED notes we format in a single page render so a first
// visit isn't slow; the rest get picked up (and cached) on subsequent loads.
const MAX_PER_RENDER = 3

function hashOf(s: string): string {
  return createHash("sha256").update(s).digest("hex").slice(0, 32)
}

async function formatWithClaude(raw: string): Promise<string | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null
  const client = new Anthropic()
  const response = await client.messages.create({
    model: "claude-opus-4-8",
    max_tokens: 2000,
    system: `You reformat court-calendar event notes for a family-law client portal. Turn the raw text into clean, easy-to-scan HTML.

Rules:
- Output ONLY an HTML fragment (no <html>/<body>, no markdown, no code fences, no commentary).
- Allowed tags: <h3>, <p>, <ul>, <li>, <strong>, <em>, <a>, <span>, <br>.
- Organize with short <h3> section headings and bullet lists where the source has lists.
- Make every URL a clickable <a href="..." target="_blank"> link with short link text (e.g. "Join Zoom meeting").
- Make email addresses mailto: links.
- Highlight critical details — meeting IDs, passwords/passcodes, deadlines, "must notify by" dates, consequences for non-compliance — with <strong> and <span style="background:#fef9c3">…</span>.
- Keep ALL substantive information; condense pure filler and fix run-together words (e.g. "proceedingswill" → "proceedings will").
- Write at a level a stressed non-lawyer client can follow.`,
    messages: [{ role: "user", content: raw }],
  })
  const text = response.content.find((b) => b.type === "text")
  return text && text.type === "text" ? text.text.trim() : null
}

// Returns a map of event id → formatted HTML for events whose notes deserve it.
export async function getFormattedNotes(events: CaseEvent[]): Promise<Record<string, string>> {
  const candidates = events.filter((e) => e.description.length >= MIN_LENGTH)
  if (candidates.length === 0) return {}

  const result: Record<string, string> = {}
  try {
    // 1. cached?
    const ids = candidates.map((e) => e.id)
    const cached = await sql`
      SELECT event_id, source_hash, html FROM event_note_ai
      WHERE event_id = ANY(${ids as unknown as string[]})
    `
    const cacheMap = new Map<string, { hash: string; html: string }>()
    for (const row of cached.rows) cacheMap.set(row.event_id, { hash: row.source_hash, html: row.html })

    const misses: CaseEvent[] = []
    for (const e of candidates) {
      const hit = cacheMap.get(e.id)
      if (hit && hit.hash === hashOf(e.description)) {
        result[e.id] = hit.html
      } else {
        misses.push(e)
      }
    }

    // 2. format a bounded number of misses this render
    await Promise.all(
      misses.slice(0, MAX_PER_RENDER).map(async (e) => {
        try {
          const html = await formatWithClaude(e.description)
          if (!html) return
          const clean = sanitizeNotesHtml(html)
          if (!clean) return
          result[e.id] = clean
          await sql`
            INSERT INTO event_note_ai (event_id, source_hash, html, updated_at)
            VALUES (${e.id}, ${hashOf(e.description)}, ${clean}, now())
            ON CONFLICT (event_id)
            DO UPDATE SET source_hash = EXCLUDED.source_hash, html = EXCLUDED.html, updated_at = now()
          `
        } catch {
          // fail soft — this event keeps its plain-text notes
        }
      })
    )
  } catch {
    // fail soft — page renders with plain-text notes
  }
  return result
}
