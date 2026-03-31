// app/api/chat/route.ts
import { auth } from "@/auth"
import { getClientByEmail } from "@/lib/airtable"
import { sql } from "@/lib/db"
import { NextResponse } from "next/server"

export async function GET() {
  const session = await auth()
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const client = await getClientByEmail(session.user.email)
  if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 })

  // Mark firm messages as read
  await sql`
    UPDATE chat_messages SET read = true
    WHERE client_id = ${client.clientId} AND sender = 'firm' AND read = false
  `

  const result = await sql`
    SELECT id, sender, body, created_at
    FROM chat_messages
    WHERE client_id = ${client.clientId}
    ORDER BY created_at ASC
    LIMIT 100
  `

  return NextResponse.json({ messages: result.rows })
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const client = await getClientByEmail(session.user.email)
  if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 })

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
    VALUES (${client.clientId}, 'client', ${body.trim()})
    RETURNING id, sender, body, created_at
  `

  return NextResponse.json({ message: result.rows[0] }, { status: 201 })
}
