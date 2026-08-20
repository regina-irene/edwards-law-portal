// lib/upload-receipt.ts - the "📎 Sent 3 documents: ..." line that appears in
// the conversation after a client sends files.
//
// Extracted on 2026-08-20 from the old single-shot upload route (since removed)
// so the two-step upload (browser to Blob, then server to Drive) can write the
// same receipt. The wording and the pattern that reads it back have to stay in
// step, which is exactly why they now live together in one file.
//
// Clients were re-uploading, or messaging to ask whether anything arrived,
// because a finished upload left no trace. The modal posts one file at a time,
// so rather than a message per file the receipt is topped up while a batch is
// still arriving: the names are kept in the message itself and read back out.
import { sql } from "@/lib/db"

const RECEIPT_WINDOW_MS = 10 * 60 * 1000
const MAX_NAMED = 5
const RECEIPT_RE = /^📎 Sent (\d+) documents?: (.*?)(?: and (\d+) more)?$/

export function receiptBody(total: number, namesPart: string, shown: number): string {
  const extra = Math.max(0, total - shown)
  return `📎 Sent ${total} ${total === 1 ? "document" : "documents"}: ${namesPart}${extra > 0 ? ` and ${extra} more` : ""}`
}

export async function recordUploadReceipt(clientId: string, fileName: string): Promise<void> {
  const last = await sql`
    SELECT id, body, created_at
    FROM chat_messages
    WHERE client_id = ${clientId} AND sender = 'client'
    ORDER BY created_at DESC
    LIMIT 1
  `
  const row = last.rows[0] as { id: string; body: unknown; created_at: string | Date } | undefined
  const isRecent = Boolean(row) && Date.now() - new Date(row!.created_at).getTime() < RECEIPT_WINDOW_MS
  const match = row && isRecent && typeof row.body === "string" ? RECEIPT_RE.exec(row.body) : null

  if (row && match) {
    const total = Number(match[1])
    const hidden = Number(match[3] ?? 0)
    const shown = Math.min(MAX_NAMED, Math.max(1, total - hidden))
    const room = shown < MAX_NAMED
    const body = receiptBody(total + 1, room ? `${match[2]}, ${fileName}` : match[2], room ? shown + 1 : shown)
    // created_at moves to the end of the batch so the receipt stays at the
    // bottom of the thread, and it counts as unread again for the firm.
    await sql`UPDATE chat_messages SET body = ${body}, created_at = NOW(), read = false WHERE id = ${row.id}`
    return
  }

  await sql`
    INSERT INTO chat_messages (client_id, sender, body)
    VALUES (${clientId}, 'client', ${receiptBody(1, fileName, 1)})
  `
}
