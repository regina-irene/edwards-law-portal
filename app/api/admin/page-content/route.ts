// app/api/admin/page-content/route.ts
import { requireAdmin } from "@/lib/admin"
import { sql } from "@/lib/db"
import { fetchAllClientsRaw, clientDisplayLabel } from "@/lib/airtable"
import { getClientLabels } from "@/lib/client-labels"
import { NextResponse } from "next/server"

async function resolveClientLabel(clientId: string): Promise<string> {
  if (clientId === "_global") return "All clients (defaults)"
  try {
    const [clients, labels] = await Promise.all([fetchAllClientsRaw(), getClientLabels()])
    const match = clients.find((c) => String(c.clientId) === clientId)
    if (!match) return clientId
    return labels[clientId] || clientDisplayLabel(match.name) || clientId
  } catch {
    return clientId
  }
}

export async function GET(req: Request) {
  const check = await requireAdmin()
  if (check.status !== "ok") return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const clientId = searchParams.get("clientId")
  if (!clientId) return NextResponse.json({ error: "clientId required" }, { status: 400 })

  try {
    const result = await sql`
      SELECT page, header, announcement FROM page_content WHERE client_id = ${clientId}
    `
    const content: Record<string, { header: string; announcement: string }> = {}
    for (const row of result.rows) {
      content[row.page] = { header: row.header ?? "", announcement: row.announcement ?? "" }
    }
    const clientLabel = await resolveClientLabel(clientId)
    return NextResponse.json({ content, clientLabel })
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function PUT(req: Request) {
  const check = await requireAdmin()
  if (check.status !== "ok") return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  let clientId: unknown, page: unknown, header: unknown, announcement: unknown
  try {
    const parsed = await req.json()
    clientId = parsed?.clientId
    page = parsed?.page
    header = parsed?.header
    announcement = parsed?.announcement
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  if (typeof clientId !== "string" || !clientId || typeof page !== "string" || !page) {
    return NextResponse.json({ error: "clientId and page required" }, { status: 400 })
  }

  const headerVal = typeof header === "string" ? header.trim() || null : null
  const announcementVal = typeof announcement === "string" ? announcement.trim() || null : null

  try {
    await sql`
      INSERT INTO page_content (client_id, page, header, announcement)
      VALUES (${clientId}, ${page}, ${headerVal}, ${announcementVal})
      ON CONFLICT (client_id, page) DO UPDATE
        SET header = EXCLUDED.header,
            announcement = EXCLUDED.announcement
    `
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
