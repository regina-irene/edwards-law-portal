// app/api/admin/forms/route.ts — the form builder's CRUD. Admin only.
import { requireAdmin } from "@/lib/admin"
import {
  listPortalForms,
  savePortalForm,
  archivePortalForm,
  getPortalForm,
  uniqueKey,
  normalizeDefinition,
  countFields,
  listStages,
} from "@/lib/portal-forms"
import { listForms, getForm } from "@/lib/fileflow"
import { NextResponse } from "next/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

async function gate() {
  const check = await requireAdmin()
  if (check.status === "unauthenticated") return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (check.status === "forbidden") return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  return null
}

export async function GET(req: Request) {
  const denied = await gate()
  if (denied) return denied

  // ?key=… returns the whole form so the builder can reopen it for editing.
  const key = new URL(req.url).searchParams.get("key")
  if (key) {
    try {
      const form = await getPortalForm(key)
      if (!form) return NextResponse.json({ error: "Not found" }, { status: 404 })
      return NextResponse.json({
        form: {
          key: form.key,
          label: form.label,
          description: form.description,
          stage: form.stage,
          sections: form.definition.sections,
        },
      })
    } catch (e) {
      console.error("[admin/forms] read failed:", e)
      return NextResponse.json({ error: "Could not open that form." }, { status: 500 })
    }
  }

  try {
    const [forms, stages] = await Promise.all([listPortalForms(), listStages()])
    return NextResponse.json({
      stages,
      forms: forms.map((f) => ({
        key: f.key,
        label: f.label,
        description: f.description,
        stage: f.stage,
        source: f.source,
        updated_at: f.updated_at,
        fieldCount: countFields(f.definition),
        sections: f.definition.sections.length,
      })),
    })
  } catch (e) {
    console.error("[admin/forms] list failed:", e)
    return NextResponse.json({ error: "Could not load forms", forms: [] }, { status: 500 })
  }
}

export async function POST(req: Request) {
  const denied = await gate()
  if (denied) return denied
  const body = await req.json().catch(() => null)
  const action = typeof body?.action === "string" ? body.action : "save"

  // Copy the two FileFlow forms into the portal so everything lives here.
  if (action === "import_fileflow") {
    try {
      const summaries = await listForms()
      const imported: string[] = []
      const skipped: string[] = []
      for (const s of summaries) {
        const existing = await getPortalForm(s.key)
        if (existing) { skipped.push(s.label); continue }
        const full = await getForm(s.key)
        if (!full) { skipped.push(s.label); continue }
        // Rebuild through normalize so ids and keys follow the portal's rules.
        const definition = normalizeDefinition(
          s.key,
          full.label,
          full.description,
          full.sections.map((sec) => ({
            title: sec.title,
            description: sec.description,
            fields: sec.fields.map((f) => ({
              label: f.label,
              fieldKey: f.fieldKey, // keep the original key so existing answers still match
              type: f.type,
              placeholder: f.placeholder,
              helpText: f.helpText,
              required: f.required,
              width: f.width,
              options: f.options,
            })),
          }))
        )
        await savePortalForm({ key: s.key, label: full.label, description: full.description, definition, source: "fileflow" })
        imported.push(full.label)
      }
      return NextResponse.json({ ok: true, imported, skipped })
    } catch (e) {
      console.error("[admin/forms] fileflow import failed:", e)
      return NextResponse.json({ error: "Could not read the FileFlow forms." }, { status: 502 })
    }
  }

  // Save a new or edited form.
  const label = typeof body?.label === "string" ? body.label.trim() : ""
  const sections = Array.isArray(body?.sections) ? body.sections : null
  if (!label || !sections) return NextResponse.json({ error: "label and sections required" }, { status: 400 })

  try {
    const key = typeof body?.key === "string" && body.key.trim() ? body.key.trim() : await uniqueKey(label)
    const definition = normalizeDefinition(key, label, typeof body?.description === "string" ? body.description.trim() || null : null, sections)
    if (definition.sections.length === 0) {
      return NextResponse.json({ error: "A form needs at least one question." }, { status: 400 })
    }
    // An empty stage means standalone — a form that sits outside every stage.
    const stage = typeof body?.stage === "string" && body.stage.trim() ? body.stage.trim() : null
    const saved = await savePortalForm({
      key,
      label,
      description: definition.description,
      definition,
      stage,
      source: typeof body?.source === "string" ? body.source : null,
    })
    return NextResponse.json({ form: { key: saved.key, label: saved.label, fieldCount: countFields(saved.definition) } }, { status: 201 })
  } catch (e) {
    console.error("[admin/forms] save failed:", e)
    return NextResponse.json({ error: "Could not save the form." }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  const denied = await gate()
  if (denied) return denied
  const key = new URL(req.url).searchParams.get("key")
  if (!key) return NextResponse.json({ error: "key required" }, { status: 400 })
  try {
    const ok = await archivePortalForm(key)
    if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 })
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error("[admin/forms] archive failed:", e)
    return NextResponse.json({ error: "Could not remove the form." }, { status: 500 })
  }
}
