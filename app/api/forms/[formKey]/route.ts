// Client-facing intake form: read the FileFlow form definition + this client's
// saved answers, and save answers (stored in THIS portal, not FileFlow).
import { getPortalClient } from "@/lib/portal-client"
import { getForm } from "@/lib/fileflow"
import { sql } from "@/lib/db"
import { NextResponse } from "next/server"

export async function GET(_req: Request, { params }: { params: Promise<{ formKey: string }> }) {
  const client = await getPortalClient()
  if (!client?.clientId) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  const { formKey } = await params

  try {
    const form = await getForm(formKey)
    if (!form) return NextResponse.json({ error: "Form not found" }, { status: 404 })

    const cid = String(client.clientId)
    const saved = await sql`
      SELECT field_key, value FROM form_responses WHERE client_id = ${cid} AND form_key = ${formKey}
    `
    const values: Record<string, string> = {}
    for (const r of saved.rows) values[r.field_key] = r.value ?? ""
    return NextResponse.json({ form, values })
  } catch (e) {
    console.error("[forms] load failed:", e)
    return NextResponse.json({ error: "Could not load form" }, { status: 500 })
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ formKey: string }> }) {
  const client = await getPortalClient()
  if (!client?.clientId) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  const { formKey } = await params

  const body = (await req.json().catch(() => null)) as { values?: Record<string, string> } | null
  if (!body || typeof body.values !== "object" || body.values === null) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 })
  }

  try {
    const cid = String(client.clientId)
    const entries = Object.entries(body.values).slice(0, 500)
    for (const [fieldKey, raw] of entries) {
      const value = typeof raw === "string" ? raw.slice(0, 10000) : ""
      await sql`
        INSERT INTO form_responses (client_id, form_key, field_key, value, updated_at)
        VALUES (${cid}, ${formKey}, ${fieldKey}, ${value}, NOW())
        ON CONFLICT (client_id, form_key, field_key)
        DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
      `
    }
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error("[forms] save failed:", e)
    return NextResponse.json({ error: "Could not save" }, { status: 500 })
  }
}
