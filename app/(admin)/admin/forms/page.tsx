"use client"
// app/(admin)/admin/forms/page.tsx — the form builder: the forms clients fill
// in, built here from a PDF or pasted text, and linked to tasks from the Tasks
// screen.
import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import PageTitle from "@/components/ui/PageTitle"
import FormBuilder, { type Draft } from "@/components/admin/forms/FormBuilder"

interface FormRow {
  key: string
  label: string
  description: string | null
  source: string | null
  updated_at: string
  fieldCount: number
  sections: number
}

function fmt(d: string): string {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "America/New_York" })
}

export default function AdminFormsPage() {
  const [forms, setForms] = useState<FormRow[]>([])
  const [loading, setLoading] = useState(true)
  const [building, setBuilding] = useState(false)
  const [editing, setEditing] = useState<Draft | null>(null)
  const [opening, setOpening] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/forms").catch(() => null)
    if (res?.ok) {
      const d = await res.json()
      setForms(d.forms ?? [])
      setError(null)
    } else {
      setError("Couldn't load your forms.")
    }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function importFileFlow() {
    setImporting(true)
    setNotice(null)
    setError(null)
    const res = await fetch("/api/admin/forms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "import_fileflow" }),
    }).catch(() => null)
    setImporting(false)
    const d = await res?.json().catch(() => null)
    if (!res?.ok) { setError(d?.error ?? "Couldn't bring the FileFlow forms over."); return }
    const imported: string[] = d.imported ?? []
    const skipped: string[] = d.skipped ?? []
    setNotice(
      imported.length
        ? `Rebuilt here: ${imported.join(", ")}.${skipped.length ? ` Already here: ${skipped.join(", ")}.` : ""}`
        : "Both FileFlow forms are already rebuilt here — nothing to bring over."
    )
    await load()
  }

  async function openForEditing(key: string) {
    setOpening(key)
    setError(null)
    setNotice(null)
    const res = await fetch(`/api/admin/forms?key=${encodeURIComponent(key)}`).catch(() => null)
    setOpening(null)
    const d = await res?.json().catch(() => null)
    if (!res?.ok || !d?.form) { setError("Couldn't open that form."); return }
    setEditing(d.form as Draft)
  }

  async function remove(key: string, label: string) {
    if (!window.confirm(`Remove "${label}"? Clients' saved answers are kept, and any task linked to it stops showing the form.`)) return
    const res = await fetch(`/api/admin/forms?key=${encodeURIComponent(key)}`, { method: "DELETE" }).catch(() => null)
    if (!res?.ok) { setError("Couldn't remove that form."); return }
    await load()
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <PageTitle
        title="Forms"
        tagline="Build the forms your clients fill in — from a PDF, from pasted text, or from scratch"
        actions={
          !building && !editing ? (
            <span className="flex items-center gap-3">
              <button
                type="button"
                onClick={importFileFlow}
                disabled={importing}
                className="text-sm text-gray-500 hover:text-gray-900 underline disabled:opacity-60"
              >
                {importing ? "Bringing them over…" : "Rebuild the FileFlow forms here"}
              </button>
              <button
                type="button"
                onClick={() => { setBuilding(true); setNotice(null) }}
                className="px-4 py-2 text-white text-sm font-semibold rounded-lg hover:opacity-90"
                style={{ background: "#1b2d45" }}
              >
                + New form
              </button>
            </span>
          ) : undefined
        }
      />

      {notice && <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-xl px-4 py-2.5">{notice}</p>}
      {error && <p className="text-sm text-red-600 bg-white border border-red-200 rounded-xl px-4 py-2.5">{error}</p>}

      {editing ? (
        <FormBuilder
          key={editing.key}
          initial={editing}
          onSaved={(label) => { setEditing(null); setNotice(`Saved your changes to “${label}”.`); load() }}
          onCancel={() => setEditing(null)}
        />
      ) : building ? (
        <FormBuilder
          onSaved={(label) => { setBuilding(false); setNotice(`Saved “${label}”. Link it to a task from the Tasks screen.`); load() }}
          onCancel={() => setBuilding(false)}
        />
      ) : loading ? (
        <p className="text-sm text-gray-400">Loading…</p>
      ) : forms.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-2">
          <p className="text-sm text-gray-600">No forms here yet.</p>
          <p className="text-sm text-gray-500">
            Start with <strong>+ New form</strong> to turn a PDF or a pasted paper form into one clients can fill in, or
            bring your two FileFlow forms over with the link above.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
          {forms.map((f) => (
            <div key={f.key} className="flex items-baseline justify-between gap-4 px-5 py-3.5">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-900">
                  {f.label}
                  {f.source === "fileflow" && <span className="ml-2 text-[11px] font-normal text-gray-400">from FileFlow</span>}
                </p>
                <p className="text-sm text-gray-500">
                  {f.fieldCount} {f.fieldCount === 1 ? "question" : "questions"} · {f.sections} {f.sections === 1 ? "section" : "sections"} · updated {fmt(f.updated_at)}
                </p>
              </div>
              <span className="shrink-0 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => openForEditing(f.key)}
                  disabled={opening !== null}
                  className="text-sm text-blue-600 hover:underline disabled:opacity-60"
                >
                  {opening === f.key ? "Opening…" : "Edit"}
                </button>
                <Link href={`/admin/forms/${encodeURIComponent(f.key)}`} className="text-sm text-blue-600 hover:underline">
                  Answers
                </Link>
                <button type="button" onClick={() => remove(f.key, f.label)} className="text-sm text-gray-400 hover:text-red-600 underline">
                  Remove
                </button>
              </span>
            </div>
          ))}
        </div>
      )}

      {!building && forms.length > 0 && (
        <p className="text-xs text-gray-400">
          To put a form in front of a client: open <Link href="/admin/tasks" className="underline">Tasks</Link>, open the task on the board, and pick the form under “Linked intake form”.
        </p>
      )}
    </div>
  )
}
