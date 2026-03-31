// app/api/admin/chat/route.ts
import { requireAdmin } from "@/lib/admin"
import { sql } from "@/lib/db"
import { NextResponse } from "next/server"

export async function GET(req: Request) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const clientId = searchParams.get("clientId")
  if (!clientId) return NextResponse.json({ error: "clientId required" }, { status: 400 })

  const result = await sql`
    SELECT id, sender, body, created_at, read
    FROM chat_messages
    WHERE client_id = ${clientId}
    ORDER BY created_at ASC
    LIMIT 100
  `

  return NextResponse.json({ messages: result.rows })
}

export async function POST(req: Request) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  let clientId: string, body: string
  try {
    const parsed = await req.json()
    clientId = parsed?.clientId
    body = parsed?.body
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  if (!clientId || !body?.trim()) {
    return NextResponse.json({ error: "clientId and body required" }, { status: 400 })
  }

  const result = await sql`
    INSERT INTO chat_messages (client_id, sender, body)
    VALUES (${clientId}, 'firm', ${body.trim()})
    RETURNING id, sender, body, created_at
  `

  return NextResponse.json({ message: result.rows[0] }, { status: 201 })
}
