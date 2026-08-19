// app/api/admin/chat/route.ts
import { requireAdmin } from "@/lib/admin"
import { sql } from "@/lib/db"
import { NextResponse } from "next/server"
import { getAllClients } from "@/lib/airtable"
import { sendSms, type SmsResult } from "@/lib/twilio"
import { sendNewMessageEmail } from "@/lib/resend"
import { sanitizeNotesHtml } from "@/lib/sanitize"
import { isHtmlBody, bodyToPlainText, isEmptyRich } from "@/lib/message-format"

export async function GET(req: Request) {
  const check = await requireAdmin()
  if (check.status === "unauthenticated") return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (check.status === "forbidden") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const clientId = searchParams.get("clientId")
  if (typeof clientId !== "string" || !clientId) {
    return NextResponse.json({ error: "clientId required" }, { status: 400 })
  }

  try {
    const result = await sql`
      SELECT id, sender, body, created_at, read, sms_status, email_status
      FROM chat_messages
      WHERE client_id = ${clientId}
      ORDER BY created_at ASC
      LIMIT 500
    `
    await sql`UPDATE chat_messages SET read = true WHERE client_id = ${clientId} AND sender = 'client' AND read = false`.catch(() => {})
    const ids = result.rows.map((r) => r.id)
    const filesByMsg = new Map<string, any[]>()
    if (ids.length) {
      const fa = await sql`SELECT id, message_id, file_name FROM message_attachments WHERE message_id = ANY(${ids as any}::uuid[])`.catch(() => ({ rows: [] as any[] }))
      for (const f of fa.rows) { const a = filesByMsg.get(f.message_id) ?? []; a.push({ id: f.id, file_name: f.file_name }); filesByMsg.set(f.message_id, a) }
    }
    const messages = result.rows.map((m) => ({ ...m, files: filesByMsg.get(m.id) ?? [] }))
    return NextResponse.json({ messages })
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(req: Request) {
  const check = await requireAdmin()
  if (check.status === "unauthenticated") return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (check.status === "forbidden") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  let clientId: unknown, body: unknown, smsRequested = false
  try {
    const parsed = await req.json()
    clientId = parsed?.clientId
    body = parsed?.body
    smsRequested = parsed?.sms === true
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  if (typeof clientId !== "string" || !clientId || typeof body !== "string" || !body.trim()) {
    return NextResponse.json({ error: "clientId and body required" }, { status: 400 })
  }

  // Rich replies arrive as HTML from the formatting-mode composer. Sanitize
  // before storing - admins are trusted, so this is defense in depth. Plain
  // bodies are stored exactly as typed, the way they always were.
  const rich = isHtmlBody(body)
  const storedBody = rich ? sanitizeNotesHtml(body).trim() : body.trim()
  if (!storedBody || (rich && isEmptyRich(storedBody))) {
    return NextResponse.json({ error: "clientId and body required" }, { status: 400 })
  }
  // Texts carry no formatting, so the SMS always goes out as plain text.
  const smsBody = bodyToPlainText(storedBody)

  try {
    const result = await sql`
      INSERT INTO chat_messages (client_id, sender, body)
      VALUES (${clientId}, 'firm', ${storedBody})
      RETURNING id, sender, body, created_at
    `

    // Notifications on firm replies. One Airtable lookup feeds both channels:
    // SMS - opt-IN via the "SMS Reminders" checkbox (sms:true = send the actual
    //   message text instead of the generic notification).
    // Email - opt-OUT via the "No Message Emails" checkbox; generic notice only
    //   (the message text stays in the portal for confidentiality).
    let sms: SmsResult | null = null
    let email: { sent: boolean; reason?: string } | null = null
    let client: Awaited<ReturnType<typeof getAllClients>>[number] | undefined
    try {
      const clients = await getAllClients()
      client = clients.find((c) => String(c.clientId) === clientId)
    } catch {
      sms = { sent: false, reason: "Could not look up the client's SMS settings" }
      email = { sent: false, reason: "Could not look up the client's email settings" }
      client = undefined
    }

    if (client) {
      try {
        if (!client.smsReminders) {
          sms = smsRequested
            ? { sent: false, reason: 'SMS Reminders is not checked for this client on the Clients board' }
            : null // auto-notification silently skipped when not opted in
        } else if (!client.phone) {
          sms = { sent: false, reason: "No phone number on file for this client" }
        } else {
          const PORTAL_URL = process.env.AUTH_URL ?? "https://edwards-law-portal.vercel.app"
          const text = smsRequested
            ? `Message from Edwards Family Law:\n\n${smsBody}\n\nReply in your portal: ${PORTAL_URL}`
            : `You have a new message from Edwards Family Law. Read and reply in your portal: ${PORTAL_URL}`
          sms = await sendSms(client.phone, text)
          if (sms.sent) {
            const status = smsRequested ? "full" : "notification"
            await sql`UPDATE chat_messages SET sms_status = ${status} WHERE id = ${result.rows[0].id}`.catch(() => {})
            ;(result.rows[0] as Record<string, unknown>).sms_status = status
          }
        }
      } catch {
        sms = { sent: false, reason: "Could not send the text" }
      }

      try {
        if (client.noMessageEmails) {
          email = null // opted out - silently skipped
        } else if (!client.email) {
          email = { sent: false, reason: "No email on file for this client" }
        } else {
          // Airtable names are "Last | First"
          const firstName = (client.name.split("|")[1] ?? "").trim()
          await sendNewMessageEmail({ to: client.email, firstName })
          email = { sent: true }
          await sql`UPDATE chat_messages SET email_status = 'notification' WHERE id = ${result.rows[0].id}`.catch(() => {})
          ;(result.rows[0] as Record<string, unknown>).email_status = "notification"
        }
      } catch {
        email = { sent: false, reason: "The email failed to send" }
      }
    } else if (!sms && !email) {
      sms = smsRequested ? { sent: false, reason: "Client not found in Airtable" } : null
      email = { sent: false, reason: "Client not found in Airtable" }
    }

    return NextResponse.json({ message: result.rows[0], sms, email }, { status: 201 })
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
