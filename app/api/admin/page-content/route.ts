// app/api/admin/page-content/route.ts
import { requireAdmin } from "@/lib/admin"
import { sql } from "@/lib/db"
import { fetchAllClientsRaw, clientDisplayLabel } from "@/lib/airtable"
import { getClientLabels } from "@/lib/client-labels"
import { sanitizeNotesHtml } from "@/lib/sanitize"
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
      SELECT page, header, announcement, embed_url, embed_height, body, image_name FROM page_content WHERE client_id = ${clientId}
    `
    const content: Record<string, { header: string; announcement: string; embed_url: string; embed_height: number | null; body: string; image_name: string }> = {}
    for (const row of result.rows) {
      content[row.page] = {
        header: row.header ?? "",
        announcement: row.announcement ?? "",
        embed_url: row.embed_url ?? "",
        embed_height: row.embed_height ?? null,
        body: row.body ?? "",
        image_name: row.image_name ?? "",
      }
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

  let clientId: unknown, page: unknown, header: unknown, announcement: unknown, embedUrl: unknown, embedHeight: unknown, body: unknown
  try {
    const parsed = await req.json()
    clientId = parsed?.clientId
    page = parsed?.page
    header = parsed?.header
    announcement = parsed?.announcement
    embedUrl = parsed?.embed_url
    embedHeight = parsed?.embed_height
    body = parsed?.body
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  if (typeof clientId !== "string" || !clientId || typeof page !== "string" || !page) {
    return NextResponse.json({ error: "clientId and page required" }, { status: 400 })
  }

  const headerVal = typeof header === "string" ? header.trim() || null : null
  // Announcement and body are rich text (HTML) - sanitize.
  const announcementVal = typeof announcement === "string" ? sanitizeNotesHtml(announcement) || null : null
  const bodyVal = typeof body === "string" ? sanitizeNotesHtml(body) || null : null
  // Embed URL: accept with or without scheme (default to https://).
  let embedVal: string | null = null
  if (typeof embedUrl === "string" && embedUrl.trim()) {
    let u = embedUrl.trim()
    if (!/^https?:\/\//i.test(u)) u = `https://${u}`
    embedVal = /^https?:\/\/.+\..+/.test(u) ? u : null
  }
  // Embed height: clamp to a sane range; null = use default.
  let heightVal: number | null = null
  const hNum = typeof embedHeight === "number" ? embedHeight : parseInt(String(embedHeight), 10)
  if (Number.isFinite(hNum) && hNum > 0) heightVal = Math.min(Math.max(Math.round(hNum), 150), 2000)

  try {
    await sql`
      INSERT INTO page_content (client_id, page, header, announcement, embed_url, embed_height, body)
      VALUES (${clientId}, ${page}, ${headerVal}, ${announcementVal}, ${embedVal}, ${heightVal}, ${bodyVal})
      ON CONFLICT (client_id, page) DO UPDATE
        SET header = EXCLUDED.header,
            announcement = EXCLUDED.announcement,
            embed_url = EXCLUDED.embed_url,
            embed_height = EXCLUDED.embed_height,
            body = EXCLUDED.body
    `
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
