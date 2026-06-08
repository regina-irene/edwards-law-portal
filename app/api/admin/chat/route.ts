// app/api/admin/chat/route.ts
import { requireAdmin } from "@/lib/admin"
import { sql } from "@/lib/db"
import { NextResponse } from "next/server"

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
      SELECT id, sender, body, created_at, read
      FROM chat_messages
      WHERE client_id = ${clientId}
      ORDER BY created_at ASC
      LIMIT 500
    `
    await sql`UPDATE chat_messages SET read = true WHERE client_id = ${clientId} AND sender = 'client' AND read = false`.catch(() => {})
    return NextResponse.json({ messages: result.rows })
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(req: Request) {
  const check = await requireAdmin()
  if (check.status === "unauthenticated") return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (check.status === "forbidden") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  let clientId: unknown, body: unknown
  try {
    const parsed = await req.json()
    clientId = parsed?.clientId
    body = parsed?.body
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  if (typeof clientId !== "string" || !clientId || typeof body !== "string" || !body.trim()) {
    return NextResponse.json({ error: "clientId and body required" }, { status: 400 })
  }

  try {
    const result = await sql`
      INSERT INTO chat_messages (client_id, sender, body)
      VALUES (${clientId}, 'firm', ${body.trim()})
      RETURNING id, sender, body, created_at
    `
    return NextResponse.json({ message: result.rows[0] }, { status: 201 })
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
