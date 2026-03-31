// app/api/messages/route.ts
import { auth } from "@/auth"
import { getClientByEmail } from "@/lib/airtable"
import { sql } from "@/lib/db"
import { NextResponse } from "next/server"

export async function GET() {
  const session = await auth()
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const client = await getClientByEmail(session.user.email)
  if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 })

  // Mark all unread messages as read
  await sql`
    UPDATE messages SET read = true
    WHERE client_id = ${client.clientId} AND read = false
  `

  const result = await sql`
    SELECT id, body, created_at, read
    FROM messages
    WHERE client_id = ${client.clientId}
    ORDER BY created_at DESC
    LIMIT 50
  `

  return NextResponse.json({ messages: result.rows })
}
