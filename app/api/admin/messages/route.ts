// app/api/admin/messages/route.ts
import { requireAdmin } from "@/lib/admin"
import { sql } from "@/lib/db"
import { NextResponse } from "next/server"

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
    INSERT INTO messages (client_id, body)
    VALUES (${clientId}, ${body.trim()})
    RETURNING id, body, created_at
  `

  return NextResponse.json({ message: result.rows[0] }, { status: 201 })
}
