// app/api/admin/messages/route.ts
import { requireAdmin } from "@/lib/admin"
import { sql } from "@/lib/db"
import { NextResponse } from "next/server"

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
      INSERT INTO messages (client_id, body)
      VALUES (${clientId}, ${body.trim()})
      RETURNING id, body, created_at
    `
    return NextResponse.json({ message: result.rows[0] }, { status: 201 })
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
