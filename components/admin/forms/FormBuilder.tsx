"use client"
// components/admin/forms/FormBuilder.tsx — build a form by uploading a PDF or
// pasting the text of one, then checking and editing what came back before it
// goes live. Nothing is saved until "Save form" is pressed.
import { useState } from "react"
import { FIELD_TYPES } from "@/lib/portal-forms"
import { ConfirmDialog } from "@/components/ui/ConfirmDialog"

// What's waiting on a confirm — a whole section, or a single question.
type PendingDelete =
  | { kind: "section"; si: number; title: string; count: number }
  | { kind: "field"; si: number; fi: number; label: string }

interface DraftField {
  label: string
  // Carried through edits untouched: it's what a client's saved answer is
  // filed under, so changing it would orphan answers already given.
  fieldKey: string
  type: string
  placeholder?: string | null
  helpText: string | null
  required: boolean
  width: string | null
  options: { value: string; label: string }[] | null
}
interface DraftSection {
  title: string
  description: string | null
  fields: DraftField[]
}
export interface Draft {
  key: string
  label: string
  description: string | null
  // Which stage of the case this form belongs to; null = standalone.
  stage?: string | null
  sections: DraftSection[]
}

const TYPE_LABELS: Record<string, string> = {
  text: "Short text",
  textarea: "Long text",
  email: "Email",
  tel: "Phone",
  date: "Date",
  number: "Number",
  currency: "Money",
  select: "Dropdown",
  radio: "Choose one",
  checkbox: "Yes / no",
}

export default function FormBuilder({
  initial,
  stages,
  onSaved,
  onCancel,
}: {
  initial?: Draft | null
  // The stages on the task board — a form is filed under one, or stands alone.
  stages: string[]
  onSaved: (label: string) => void
  onCancel: () => void
}) {
  const [mode, setMode] = useState<"pdf" | "text">("pdf")
  const [label, setLabel] = useState(initial?.label ?? "")
  const [stage, setStage] = useState(initial?.stage ?? "")
  const [pasted, setPasted] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [draft, setDraft] = useState<Draft | null>(initial ?? null)
  const [converting, setConverting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null)

  async function convert() {
    setError(null)
    setNotice(null)
    setConverting(true)
    try {
      let res: Response | null
      if (mode === "pdf") {
        if (!file) { setError("Choose a PDF first."); setConverting(false); return }
        const fd = new FormData()
        fd.append("file", file)
        if (label.trim()) fd.append("label", label.trim())
        res = await fetch("/api/admin/forms/convert", { method: "POST", body: fd }).catch(() => null)
      } else {
        if (!pasted.trim()) { setError("Paste the form's text first."); setConverting(false); return }
        res = await fetch("/api/admin/forms/convert", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: pasted, label: label.trim() || undefined }),
        }).catch(() => null)
      }
      if (!res) { setError("Couldn't reach the server — try again."); return }
      const data = await res.json().catch(() => null)
      if (!res.ok) { setError(data?.error ?? "The conversion didn't work."); return }
      setDraft(data.draft as Draft)
      if (!label.trim()) setLabel((data.draft as Draft).label)
      setNotice(`Found ${data.fieldCount} ${data.fieldCount === 1 ? "question" : "questions"}. Check them over before saving.`)
    } finally {
      setConverting(false)
    }
  }

  function editField(si: number, fi: number, patch: Partial<DraftField>) {
    setDraft((d) => {
      if (!d) return d
      const sections = d.sections.map((s, i) =>
        i !== si ? s : { ...s, fields: s.fields.map((f, j) => (j === fi ? { ...f, ...patch } : f)) }
      )
      return { ...d, sections }
    })
  }

  // Removing a question used to happen on a single stray click, with the ✕
  // sitting right next to the move arrows — it asks first now.
  function removeField(si: number, fi: number) {
    setDraft((d) => {
      if (!d) return d
      const sections = d.sections
        .map((s, i) => (i !== si ? s : { ...s, fields: s.fields.filter((_, j) => j !== fi) }))
        .filter((s) => s.fields.length > 0)
      return { ...d, sections }
    })
  }

  // Order is what a client reads top to bottom, so it has to be changeable.
  function moveField(si: number, fi: number, by: -1 | 1) {
    setDraft((d) => {
      if (!d) return d
      const sections = d.sections.map((s, i) => {
        if (i !== si) return s
        const to = fi + by
        if (to < 0 || to >= s.fields.length) return s
        const fields = [...s.fields]
        ;[fields[fi], fields[to]] = [fields[to], fields[fi]]
        return { ...s, fields }
      })
      return { ...d, sections }
    })
  }

  function moveSection(si: number, by: -1 | 1) {
    setDraft((d) => {
      if (!d) return d
      const to = si + by
      if (to < 0 || to >= d.sections.length) return d
      const sections = [...d.sections]
      ;[sections[si], sections[to]] = [sections[to], sections[si]]
      return { ...d, sections }
    })
  }

  // Bulk required toggles: marking 65 questions one at a time is a chore, and
  // most forms want either everything mandatory or almost nothing.
  function setAllRequired(required: boolean) {
    setDraft((d) =>
      d ? { ...d, sections: d.sections.map((s) => ({ ...s, fields: s.fields.map((f) => ({ ...f, required })) })) } : d
    )
  }

  function setSectionRequired(si: number, required: boolean) {
    setDraft((d) =>
      d
        ? { ...d, sections: d.sections.map((s, i) => (i === si ? { ...s, fields: s.fields.map((f) => ({ ...f, required })) } : s)) }
        : d
    )
  }

  function removeSection(si: number) {
    setDraft((d) => (d ? { ...d, sections: d.sections.filter((_, i) => i !== si) } : d))
  }

  function runPendingDelete() {
    if (!pendingDelete) return
    if (pendingDelete.kind === "section") removeSection(pendingDelete.si)
    else removeField(pendingDelete.si, pendingDelete.fi)
    setPendingDelete(null)
  }

  function addField(si: number) {
    setDraft((d) => {
      if (!d) return d
      const sections = d.sections.map((s, i) =>
        i !== si
          ? s
          : { ...s, fields: [...s.fields, { label: "New question", fieldKey: "", type: "text", helpText: null, required: false, width: "full", options: null }] }
      )
      return { ...d, sections }
    })
  }

  function addSection() {
    setDraft((d) =>
      d
        ? { ...d, sections: [...d.sections, { title: "New section", description: null, fields: [{ label: "New question", fieldKey: "", type: "text", helpText: null, required: false, width: "full", options: null }] }] }
        : { key: "", label: label.trim() || "New form", description: null, sections: [{ title: "Questions", description: null, fields: [{ label: "New question", fieldKey: "", type: "text", helpText: null, required: false, width: "full", options: null }] }] }
    )
  }

  async function save() {
    if (!draft) return
    if (!label.trim()) { setError("Give the form a name."); return }
    setSaving(true)
    setError(null)
    const res = await fetch("/api/admin/forms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        key: draft.key || undefined,
        label: label.trim(),
        description: draft.description,
        stage: stage || null,
        sections: draft.sections,
      }),
    }).catch(() => null)
    setSaving(false)
    const data = await res?.json().catch(() => null)
    if (!res?.ok) { setError(data?.error ?? "Couldn't save the form."); return }
    onSaved(label.trim())
  }

  const totalFields = draft?.sections.reduce((n, s) => n + s.fields.length, 0) ?? 0
  const requiredCount = draft?.sections.reduce((n, s) => n + s.fields.filter((f) => f.required).length, 0) ?? 0

  return (
    <div className="space-y-5">
      <section className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <h2 className="serif text-lg font-semibold text-gray-900">
          {initial ? "Edit form" : "Build a form"}
        </h2>
        {initial && (
          <p className="text-xs text-gray-500">
            Editing the live form. Rewording a question keeps the answers clients have already given against it;
            deleting one hides it from the form but leaves those answers in place.
          </p>
        )}

        <div className="flex flex-wrap gap-4 items-end">
          <div className="flex flex-col gap-1 flex-1 min-w-[16rem]">
            <label htmlFor="form-label" className="text-xs font-semibold text-gray-500">Form name</label>
            <input
              id="form-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Client Information Worksheet"
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="form-stage" className="text-xs font-semibold text-gray-500">Stage</label>
            <select
              id="form-stage"
              value={stage}
              onChange={(e) => setStage(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Standalone — no stage</option>
              {stages.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <span className="text-[11px] text-gray-400">The same stages as your task board</span>
          </div>
        </div>

        {!initial && (
          <>
            <div className="flex items-center gap-2">
              {(["pdf", "text"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  className={`px-3.5 py-1.5 rounded-full text-sm font-semibold border ${mode === m ? "text-white border-transparent" : "bg-white text-gray-600 border-gray-300 hover:border-gray-400"}`}
                  style={mode === m ? { background: "#1b2d45" } : undefined}
                >
                  {m === "pdf" ? "Upload a PDF" : "Paste the text"}
                </button>
              ))}
            </div>

            {mode === "pdf" ? (
              <div className="space-y-1.5">
                <label className="inline-flex items-center gap-2 text-sm text-blue-600 cursor-pointer hover:underline">
                  {file ? `📄 ${file.name}` : "Choose a PDF of the form"}
                  <input
                    type="file"
                    accept="application/pdf,.pdf"
                    className="hidden"
                    onChange={(e) => { setFile(e.target.files?.[0] ?? null); e.target.value = "" }}
                  />
                </label>
                <p className="text-xs text-gray-400">The whole form, up to 25 MB. Scanned pages are fine.</p>
              </div>
            ) : (
              <div className="space-y-1.5">
                <label htmlFor="form-text" className="sr-only">Form text</label>
                <textarea
                  id="form-text"
                  value={pasted}
                  onChange={(e) => setPasted(e.target.value)}
                  rows={8}
                  placeholder="Paste the questions from the form here — headings, questions, instructions, anything the client is asked to fill in."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            )}

            <div className="flex items-center gap-3 flex-wrap">
              <button
                type="button"
                onClick={convert}
                disabled={converting}
                className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-60"
              >
                {converting ? "Reading the form…" : "Convert to a form"}
              </button>
              <button type="button" onClick={addSection} className="text-sm text-gray-500 hover:text-gray-900 hover:underline">
                or start from scratch
              </button>
              {converting && <span className="text-xs text-gray-500">Long forms can take a minute or two.</span>}
            </div>
          </>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}
        {notice && <p className="text-sm text-green-700">{notice}</p>}
      </section>

      {draft && (
        <section className="space-y-3">
          <div className="flex items-baseline gap-3 flex-wrap">
            <p className="section-label">Questions</p>
            <span className="text-xs text-gray-400">
              {totalFields} {totalFields === 1 ? "question" : "questions"} in {draft.sections.length} {draft.sections.length === 1 ? "section" : "sections"} — edit anything that came out wrong
            </span>
          </div>

          <div className="flex items-center gap-3 flex-wrap bg-white rounded-xl border border-gray-200 px-4 py-2.5">
            <span className="text-xs font-semibold text-gray-500">
              Required: {requiredCount} of {totalFields}
            </span>
            <button
              type="button"
              onClick={() => setAllRequired(true)}
              disabled={requiredCount === totalFields}
              className="text-sm text-blue-600 hover:underline disabled:text-gray-300 disabled:no-underline"
            >
              Make every question required
            </button>
            <span className="text-gray-300" aria-hidden="true">·</span>
            <button
              type="button"
              onClick={() => setAllRequired(false)}
              disabled={requiredCount === 0}
              className="text-sm text-blue-600 hover:underline disabled:text-gray-300 disabled:no-underline"
            >
              Make none required
            </button>
            <span className="ml-auto text-xs text-gray-400">
              A required question is flagged in red to the client until they answer it.
            </span>
          </div>

          {draft.sections.map((section, si) => (
            <div key={si} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-200 space-y-1.5">
                <div className="flex items-center gap-2">
                  <input
                    value={section.title}
                    onChange={(e) =>
                      setDraft((d) => (d ? { ...d, sections: d.sections.map((s, i) => (i === si ? { ...s, title: e.target.value } : s)) } : d))
                    }
                    aria-label={`Section ${si + 1} name`}
                    className="serif text-base font-semibold text-gray-900 bg-transparent flex-1 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded px-1"
                  />
                  <button type="button" onClick={() => moveSection(si, -1)} disabled={si === 0} aria-label="Move section up" title="Move section up" className="px-1.5 text-gray-400 hover:text-gray-800 disabled:opacity-30">↑</button>
                  <button type="button" onClick={() => moveSection(si, 1)} disabled={si === draft.sections.length - 1} aria-label="Move section down" title="Move section down" className="px-1.5 text-gray-400 hover:text-gray-800 disabled:opacity-30">↓</button>
                  <button type="button" onClick={() => setPendingDelete({ kind: "section", si, title: section.title, count: section.fields.length })} aria-label="Delete section" title="Delete section" className="px-1.5 text-gray-400 hover:text-red-600">🗑️</button>
                </div>
                <input
                  value={section.description ?? ""}
                  onChange={(e) =>
                    setDraft((d) => (d ? { ...d, sections: d.sections.map((s, i) => (i === si ? { ...s, description: e.target.value || null } : s)) } : d))
                  }
                  aria-label={`Section ${si + 1} instructions`}
                  placeholder="Instructions under the heading (optional)"
                  className="w-full text-xs text-gray-600 bg-transparent focus:outline-none focus:ring-2 focus:ring-blue-500 rounded px-1 py-0.5"
                />
                <p className="flex items-center gap-2 text-[11px] text-gray-400 px-1">
                  <span>
                    {section.fields.filter((f) => f.required).length} of {section.fields.length} required in this section
                  </span>
                  <button
                    type="button"
                    onClick={() => setSectionRequired(si, true)}
                    disabled={section.fields.every((f) => f.required)}
                    className="text-blue-600 hover:underline disabled:text-gray-300 disabled:no-underline"
                  >
                    all
                  </button>
                  <span className="text-gray-300" aria-hidden="true">·</span>
                  <button
                    type="button"
                    onClick={() => setSectionRequired(si, false)}
                    disabled={section.fields.every((f) => !f.required)}
                    className="text-blue-600 hover:underline disabled:text-gray-300 disabled:no-underline"
                  >
                    none
                  </button>
                </p>
              </div>
              <ul className="divide-y divide-gray-100">
                {section.fields.map((field, fi) => (
                  <li key={fi} className="px-4 py-3 space-y-2">
                    <div className="flex items-start gap-2 flex-wrap">
                      <input
                        value={field.label}
                        onChange={(e) => editField(si, fi, { label: e.target.value })}
                        aria-label="Question"
                        className="flex-1 min-w-[16rem] px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <select
                        value={field.type}
                        onChange={(e) => editField(si, fi, { type: e.target.value, options: ["select", "radio"].includes(e.target.value) ? field.options ?? [{ value: "yes", label: "Yes" }, { value: "no", label: "No" }] : null })}
                        aria-label="Answer type"
                        className="px-2 py-2 border border-gray-300 rounded-lg text-sm text-gray-900"
                      >
                        {FIELD_TYPES.map((t) => <option key={t} value={t}>{TYPE_LABELS[t] ?? t}</option>)}
                      </select>
                      <label className="flex items-center gap-1.5 text-xs text-gray-600 px-1 py-2">
                        <input
                          type="checkbox"
                          checked={field.required}
                          onChange={(e) => editField(si, fi, { required: e.target.checked })}
                          className="w-4 h-4 rounded border-gray-300"
                        />
                        Required
                      </label>
                      <span className="flex items-center">
                        <button type="button" onClick={() => moveField(si, fi, -1)} disabled={fi === 0} aria-label={`Move ${field.label} up`} title="Move up" className="px-1.5 py-2 text-gray-400 hover:text-gray-800 disabled:opacity-30">↑</button>
                        <button type="button" onClick={() => moveField(si, fi, 1)} disabled={fi === section.fields.length - 1} aria-label={`Move ${field.label} down`} title="Move down" className="px-1.5 py-2 text-gray-400 hover:text-gray-800 disabled:opacity-30">↓</button>
                        <button
                          type="button"
                          onClick={() => setPendingDelete({ kind: "field", si, fi, label: field.label })}
                          aria-label={`Remove ${field.label}`}
                          title="Remove question"
                          className="px-2 py-2 text-gray-400 hover:text-red-600"
                        >
                          ✕
                        </button>
                      </span>
                    </div>
                    {(field.type === "select" || field.type === "radio") && (
                      <input
                        value={(field.options ?? []).map((o) => o.label).join(", ")}
                        onChange={(e) =>
                          editField(si, fi, {
                            options: e.target.value
                              .split(",")
                              .map((s) => s.trim())
                              .filter(Boolean)
                              .map((l) => ({ value: l.toLowerCase().replace(/[^a-z0-9]+/g, "-"), label: l })),
                          })
                        }
                        aria-label="Choices, separated by commas"
                        placeholder="Choices, separated by commas"
                        className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-xs text-gray-900"
                      />
                    )}
                    <div className="flex items-center gap-2 flex-wrap">
                      <input
                        value={field.helpText ?? ""}
                        onChange={(e) => editField(si, fi, { helpText: e.target.value || null })}
                        aria-label={`Help text for ${field.label}`}
                        placeholder="Help text shown under the question (optional)"
                        className="flex-1 min-w-[14rem] px-3 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-700"
                      />
                      {!["checkbox", "select", "radio", "date"].includes(field.type) && (
                        <input
                          value={field.placeholder ?? ""}
                          onChange={(e) => editField(si, fi, { placeholder: e.target.value || null })}
                          aria-label={`Example answer for ${field.label}`}
                          placeholder="Example answer (optional)"
                          className="w-48 px-3 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-700"
                        />
                      )}
                      <label className="flex items-center gap-1.5 text-xs text-gray-500">
                        <input
                          type="checkbox"
                          checked={field.width === "half"}
                          onChange={(e) => editField(si, fi, { width: e.target.checked ? "half" : "full" })}
                          className="w-3.5 h-3.5 rounded border-gray-300"
                        />
                        Half width
                      </label>
                    </div>
                  </li>
                ))}
              </ul>
              <div className="px-4 py-2 bg-gray-50 border-t border-gray-100">
                <button type="button" onClick={() => addField(si)} className="text-sm text-blue-600 hover:underline">+ Add question</button>
              </div>
            </div>
          ))}

          <div className="flex items-center gap-3 flex-wrap">
            <button
              type="button"
              onClick={save}
              disabled={saving || totalFields === 0}
              className="px-4 py-2 text-white text-sm font-semibold rounded-lg hover:opacity-90 disabled:opacity-60"
              style={{ background: "#1b2d45" }}
            >
              {saving ? "Saving…" : "Save form"}
            </button>
            <button type="button" onClick={addSection} className="text-sm text-blue-600 hover:underline">+ Add section</button>
            <button type="button" onClick={onCancel} className="text-sm text-gray-400 hover:text-gray-700 underline">Cancel</button>
          </div>
        </section>
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        title={
          pendingDelete?.kind === "section"
            ? `Delete the “${pendingDelete.title}” section?`
            : "Delete this question?"
        }
        body={
          pendingDelete?.kind === "section"
            ? `Its ${pendingDelete.count} ${pendingDelete.count === 1 ? "question goes" : "questions go"} with it. Nothing is saved until you press “Save form”.`
            : pendingDelete
              ? `“${pendingDelete.label}” comes off the form. Nothing is saved until you press “Save form”.`
              : ""
        }
        confirmLabel={pendingDelete?.kind === "section" ? "Delete section" : "Delete question"}
        onConfirm={runPendingDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  )
}
