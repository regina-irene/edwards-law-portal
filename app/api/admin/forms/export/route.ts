// app/api/admin/forms/export/route.ts — download one client's completed form
// as CSV (Excel) or .doc (Word). Admin only.
import { requireAdmin } from "@/lib/admin"
import { getPortalForm } from "@/lib/portal-forms"
import { getForm } from "@/lib/fileflow"
import { loadAnswers, buildCompletedForm, toCsv, type CompletedForm } from "@/lib/form-responses"
import { fetchAllClientsRaw, clientDisplayLabel } from "@/lib/airtable"
import { getClientLabels } from "@/lib/client-labels"
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}

// Word opens an HTML document with a .doc extension — the same approach the
// Message Center transcripts use.
function toWordHtml(form: CompletedForm, clientLabel: string): string {
  const rows = form.sections
    .map(
      (section) => `
      <h2 style="font-family:Georgia,serif;font-size:14pt;margin:18pt 0 6pt">${escapeHtml(section.title)}</h2>
      <table style="width:100%;border-collapse:collapse;font-family:Arial,sans-serif;font-size:11pt">
        ${section.fields
          .map(
            (f) => `<tr>
              <td style="padding:4pt 8pt 4pt 0;vertical-align:top;width:40%;color:#555">${escapeHtml(f.label)}</td>
              <td style="padding:4pt 0;vertical-align:top">${f.answered ? escapeHtml(f.value) : "<i>not answered</i>"}</td>
            </tr>`
          )
          .join("")}
      </table>`
    )
    .join("")

  return `<html><head><meta charset="utf-8"><title>${escapeHtml(form.label)}</title></head><body>
    <h1 style="font-family:Georgia,serif;font-size:18pt;margin-bottom:2pt">${escapeHtml(form.label)}</h1>
    <p style="font-family:Arial,sans-serif;font-size:10pt;color:#666;margin-top:0">
      ${escapeHtml(clientLabel)} — ${form.answered} of ${form.total} answered${
        form.updatedAt ? ` · last saved ${escapeHtml(new Date(form.updatedAt).toLocaleString("en-US", { timeZone: "America/New_York" }))}` : ""
      }
    </p>
    ${rows}
  </body></html>`
}

export async function GET(req: Request) {
  const check = await requireAdmin()
  if (check.status === "unauthenticated") return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (check.status !== "ok") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const url = new URL(req.url)
  const key = url.searchParams.get("key") ?? ""
  const clientId = url.searchParams.get("clientId") ?? ""
  const format = url.searchParams.get("format") === "doc" ? "doc" : "csv"
  if (!key || !clientId) return NextResponse.json({ error: "key and clientId required" }, { status: 400 })

  try {
    const portal = await getPortalForm(key).catch(() => null)
    const definition = portal ? portal.definition : await getForm(key)
    if (!definition) return NextResponse.json({ error: "Form not found" }, { status: 404 })

    const [{ values, updatedAt }, clients, labels] = await Promise.all([
      loadAnswers(clientId, key),
      fetchAllClientsRaw().catch(() => []),
      getClientLabels().catch(() => ({}) as Record<string, string>),
    ])
    const match = clients.find((c) => String(c.clientId) === clientId)
    const clientLabel = labels[clientId] || (match ? clientDisplayLabel(match.name) : "") || clientId

    const completed = buildCompletedForm(clientId, definition, values, updatedAt)
    const stem = `${definition.label} - ${clientLabel}`.replace(/[^\w .-]+/g, " ").trim() || "completed-form"

    const body = format === "csv" ? toCsv(completed, clientLabel) : toWordHtml(completed, clientLabel)
    return new NextResponse(body, {
      headers: {
        "Content-Type": format === "csv" ? "text/csv; charset=utf-8" : "application/msword; charset=utf-8",
        "Content-Disposition": `attachment; filename="${stem}.${format === "csv" ? "csv" : "doc"}"`,
        "X-Filename": `${stem}.${format === "csv" ? "csv" : "doc"}`,
        "Cache-Control": "private, no-cache",
      },
    })
  } catch (e) {
    console.error("[forms/export] failed:", e)
    return NextResponse.json({ error: "Could not build the export." }, { status: 500 })
  }
}
