// app/api/admin/forms/convert/route.ts — turn an uploaded PDF or pasted text
// into a draft form definition. Nothing is saved here: the draft goes back to
// the builder for Regina to check and edit before it becomes a form.
import { requireAdmin } from "@/lib/admin"
import { convertToForm, conversionConfigured } from "@/lib/form-convert"
import { uniqueKey } from "@/lib/portal-forms"
import { NextResponse } from "next/server"

export const runtime = "nodejs"
export const maxDuration = 300

const MAX_PDF_BYTES = 25 * 1024 * 1024
const MAX_TEXT_CHARS = 200_000

export async function POST(req: Request) {
  const check = await requireAdmin()
  if (check.status === "unauthenticated") return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (check.status !== "ok") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  if (!conversionConfigured()) {
    return NextResponse.json(
      { error: "Form conversion isn't switched on for this site yet (the AI key is missing)." },
      { status: 503 }
    )
  }

  const contentType = req.headers.get("content-type") ?? ""
  let text = ""
  let pdfBase64 = ""
  let labelHint = ""
  let sourceName = ""

  try {
    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData()
      const file = form.get("file")
      labelHint = typeof form.get("label") === "string" ? String(form.get("label")).trim() : ""
      if (!(file instanceof File)) return NextResponse.json({ error: "Attach a PDF." }, { status: 400 })
      if (file.size > MAX_PDF_BYTES) return NextResponse.json({ error: "That PDF is too big (25 MB max)." }, { status: 413 })
      if (!/pdf$/i.test(file.type) && !/\.pdf$/i.test(file.name)) {
        return NextResponse.json({ error: "That file isn't a PDF. Paste the text instead." }, { status: 400 })
      }
      pdfBase64 = Buffer.from(await file.arrayBuffer()).toString("base64")
      sourceName = file.name
      if (!labelHint) labelHint = file.name.replace(/\.pdf$/i, "").replace(/[_-]+/g, " ").trim()
    } else {
      const body = await req.json().catch(() => null)
      text = typeof body?.text === "string" ? body.text.trim() : ""
      labelHint = typeof body?.label === "string" ? body.label.trim() : ""
      if (!text) return NextResponse.json({ error: "Paste the form's text first." }, { status: 400 })
      if (text.length > MAX_TEXT_CHARS) return NextResponse.json({ error: "That's too long to convert in one go — split it up." }, { status: 413 })
      sourceName = "pasted text"
    }
  } catch (e) {
    console.error("[forms/convert] could not read the request:", e)
    return NextResponse.json({ error: "Could not read what you sent." }, { status: 400 })
  }

  try {
    const key = await uniqueKey(labelHint || "form")
    const { definition, fieldCount } = await convertToForm({ key, labelHint, text, pdfBase64 })
    if (fieldCount === 0) {
      return NextResponse.json(
        { error: "No questions were found in that document — check it's the form itself, not a cover letter." },
        { status: 422 }
      )
    }
    return NextResponse.json({ draft: definition, fieldCount, source: sourceName })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    console.error("[forms/convert] conversion failed:", message)
    return NextResponse.json({ error: "The conversion didn't work. Try again, or paste the text instead." }, { status: 502 })
  }
}
