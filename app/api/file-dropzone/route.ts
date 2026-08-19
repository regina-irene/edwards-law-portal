// app/api/file-dropzone/route.ts — client: upload a dropped file to the firm's
// Google Drive folder, and leave a note in the conversation saying it arrived.
import { getPortalClient } from "@/lib/portal-client"
import { deliverClientUpload, driveConfigured } from "@/lib/client-uploads"
import { sql } from "@/lib/db"
import { NextResponse } from "next/server"

export const runtime = "nodejs"

// Clients were re-uploading, or messaging to ask whether anything came through,
// because a finished upload left no trace anywhere. Every upload now writes a
// receipt into the conversation so both sides can see what was sent and when.
//
// The modal posts one file per request, so rather than a message per file the
// receipt is topped up while a batch is still arriving: the names are kept in
// the message itself and read back out of it, which is why the wording below
// and the pattern that parses it have to stay in step.
const RECEIPT_WINDOW_MS = 10 * 60 * 1000
const MAX_NAMED = 5
const RECEIPT_RE = /^📎 Sent (\d+) documents?: (.*?)(?: and (\d+) more)?$/

function receiptBody(total: number, namesPart: string, shown: number): string {
  const extra = Math.max(0, total - shown)
  return `📎 Sent ${total} ${total === 1 ? "document" : "documents"}: ${namesPart}${extra > 0 ? ` and ${extra} more` : ""}`
}

async function recordUploadReceipt(clientId: string, fileName: string): Promise<void> {
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

export async function POST(req: Request) {
  const client = await getPortalClient()
  if (!client) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const form = await req.formData().catch(() => null)
  const file = form?.get("file")
  if (!(file instanceof File)) return NextResponse.json({ error: "file required" }, { status: 400 })

  // relativePath is "folder/sub/name.pdf" when the file came from a dropped folder; just the
  // name for a loose file. Split into folder segments + the bare file name.
  const rawPath = (typeof form?.get("relativePath") === "string" ? (form!.get("relativePath") as string) : "") || file.name
  const segments = rawPath.split("/").map((s) => s.trim()).filter(Boolean)
  const baseName = segments.pop() || file.name

  if (!process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    return NextResponse.json({ error: "File uploads aren't connected yet. Please email your documents for now." }, { status: 503 })
  }
  if (!driveConfigured()) {
    return NextResponse.json({ error: "File uploads aren't set up yet." }, { status: 503 })
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer())
    // Everything lands in the client's own folder; a dropped folder keeps its
    // structure underneath it.
    const { delivered, link } = await deliverClientUpload({
      clientId: String(client.clientId),
      fileName: baseName,
      buffer,
      mimeType: file.type,
      subPath: segments,
    })
    if (!delivered) return NextResponse.json({ error: "Upload failed. Please try again." }, { status: 500 })

    // Fail-soft: the file is safely with the firm either way, so a database
    // hiccup here must never turn a good upload into an error for the client.
    try {
      await recordUploadReceipt(String(client.clientId), baseName)
    } catch (e) {
      console.error("[file-dropzone client] upload receipt failed:", e instanceof Error ? e.message : e)
    }

    return NextResponse.json({ ok: true, link })
  } catch (e) {
    console.error("[file-dropzone client] drive upload failed:", e instanceof Error ? e.message : e)
    return NextResponse.json({ error: "Upload failed. Please try again." }, { status: 500 })
  }
}
