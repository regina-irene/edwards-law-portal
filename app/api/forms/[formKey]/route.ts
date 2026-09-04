// Client-facing intake form: read the form definition + this client's saved
// answers, and save answers (stored in THIS portal, not FileFlow).
//
// Forms built in the portal's builder take precedence; a key that isn't one of
// those falls back to FileFlow, so tasks linked before the builder existed
// keep working.
import { getPortalClient } from "@/lib/portal-client"
import { assertClientCanWrite } from "@/lib/client-write-guard"
import { getForm } from "@/lib/fileflow"
import { getPortalForm } from "@/lib/portal-forms"
import { notifyFormSaved } from "@/lib/form-notify"
import { sql } from "@/lib/db"
import { NextResponse } from "next/server"

/**
 * The form's human title, for the notification email. Falls back to the key,
 * which is ugly but readable, rather than failing the save.
 */
async function formLabelFor(formKey: string): Promise<string> {
  const portal = await getPortalForm(formKey).catch(() => null)
  return portal?.definition?.label || portal?.label || formKey
}

export async function GET(_req: Request, { params }: { params: Promise<{ formKey: string }> }) {
  const client = await getPortalClient()
  if (!client?.clientId) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  const { formKey } = await params

  try {
    const portal = await getPortalForm(formKey).catch(() => null)
    const form = portal ? portal.definition : await getForm(formKey)
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
  // Saved answers stay readable (GET) after a case closes; they just stop
  // accepting changes.
  const gate = await assertClientCanWrite()
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status })
  const client = gate.client
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

    // Tell the firm. Deliberately NOT awaited: the answers are already safely
    // in the database, and an email problem must not turn a successful save
    // into a red error on the client's screen. notifyFormSaved rate-limits
    // itself, so pressing Save five times in an afternoon still sends one.
    const answered = entries.filter(([, v]) => typeof v === "string" && v.trim() !== "").length
    void notifyFormSaved({
      clientId: cid,
      clientName: client.name || client.email || "A client",
      formKey,
      formLabel: await formLabelFor(formKey),
      answered,
    })

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error("[forms] save failed:", e)
    return NextResponse.json({ error: "Could not save" }, { status: 500 })
  }
}
