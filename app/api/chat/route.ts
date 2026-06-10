// app/api/chat/route.ts — client side of the two-way conversation
import { getPortalClient } from "@/lib/portal-client"
import { sql } from "@/lib/db"
import { NextResponse } from "next/server"
import { getWatch, getAdminPhone } from "@/lib/sms-watch"
import { sendSms } from "@/lib/twilio"
import { clientDisplayLabel } from "@/lib/airtable"

export async function GET() {
  const client = await getPortalClient()
  if (!client?.clientId) return NextResponse.json({ error: "Client not found" }, { status: 404 })
  const cid = String(client.clientId)

  await sql`UPDATE chat_messages SET read = true WHERE client_id = ${cid} AND sender = 'firm' AND read = false`.catch(() => {})

  const result = await sql`
    SELECT id, sender, body, created_at
    FROM chat_messages
    WHERE client_id = ${cid}
    ORDER BY created_at ASC
    LIMIT 500
  `
  const ids = result.rows.map((r) => r.id)
  const filesByMsg = new Map<string, any[]>()
  if (ids.length) {
    const fa = await sql`SELECT id, message_id, file_name FROM message_attachments WHERE message_id = ANY(${ids as any}::uuid[])`.catch(() => ({ rows: [] as any[] }))
    for (const f of fa.rows) { const a = filesByMsg.get(f.message_id) ?? []; a.push({ id: f.id, file_name: f.file_name }); filesByMsg.set(f.message_id, a) }
  }
  const messages = result.rows.map((m) => ({ ...m, files: filesByMsg.get(m.id) ?? [] }))
  return NextResponse.json({ messages })
}

export async function POST(req: Request) {
  const client = await getPortalClient()
  if (!client?.clientId) return NextResponse.json({ error: "Client not found" }, { status: 404 })
  const cid = String(client.clientId)

  let body: string
  try {
    const parsed = await req.json()
    body = parsed?.body
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }
  if (!body || typeof body !== "string" || body.trim().length === 0) {
    return NextResponse.json({ error: "Message body is required" }, { status: 400 })
  }

  const result = await sql`
    INSERT INTO chat_messages (client_id, sender, body)
    VALUES (${cid}, 'client', ${body.trim()})
    RETURNING id, sender, body, created_at
  `

  // "Text me when this client replies" — notify the firm cell if Regina has
  // the watch switched on for this conversation. Fail-soft: never block the
  // client's message on a notification problem.
  try {
    if (await getWatch(cid)) {
      const adminPhone = await getAdminPhone()
      if (adminPhone) {
        const who = clientDisplayLabel(client.name) || client.name || "A client"
        const preview = body.trim().slice(0, 140)
        await sendSms(adminPhone, `📨 ${who} replied in the portal:\n\n"${preview}${body.trim().length > 140 ? "…" : ""}"`)
      }
    }
  } catch {
    // notification is best-effort
  }

  return NextResponse.json({ message: result.rows[0] }, { status: 201 })
}
