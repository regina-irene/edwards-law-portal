"use client"
// components/admin/forms/FormBuilder.tsx — build a form by uploading a PDF or
// pasting the text of one, then checking and editing what came back before it
// goes live. Nothing is saved until "Save form" is pressed.
import { useState } from "react"
import { FIELD_TYPES } from "@/lib/portal-forms"

interface DraftField {
  label: string
  fieldKey: string
  type: string
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
  onSaved,
  onCancel,
}: {
  initial?: Draft | null
  onSaved: (label: string) => void
  onCancel: () => void
}) {
  const [mode, setMode] = useState<"pdf" | "text">("pdf")
  const [label, setLabel] = useState(initial?.label ?? "")
  const [pasted, setPasted] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [draft, setDraft] = useState<Draft | null>(initial ?? null)
  const [converting, setConverting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

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

  function removeField(si: number, fi: number) {
    setDraft((d) => {
      if (!d) return d
      const sections = d.sections
        .map((s, i) => (i !== si ? s : { ...s, fields: s.fields.filter((_, j) => j !== fi) }))
        .filter((s) => s.fields.length > 0)
      return { ...d, sections }
    })
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
        sections: draft.sections,
      }),
    }).catch(() => null)
    setSaving(false)
    const data = await res?.json().catch(() => null)
    if (!res?.ok) { setError(data?.error ?? "Couldn't save the form."); return }
    onSaved(label.trim())
  }

  const totalFields = draft?.sections.reduce((n, s) => n + s.fields.length, 0) ?? 0

  return (
    <div className="space-y-5">
      <section className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <h2 className="serif text-lg font-semibold text-gray-900">
          {initial ? "Edit form" : "Build a form"}
        </h2>

        <div className="flex flex-col gap-1 max-w-md">
          <label htmlFor="form-label" className="text-xs font-semibold text-gray-500">Form name</label>
          <input
            id="form-label"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g. Client Information Worksheet"
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
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

          {draft.sections.map((section, si) => (
            <div key={si} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-200">
                <input
                  value={section.title}
                  onChange={(e) =>
                    setDraft((d) => (d ? { ...d, sections: d.sections.map((s, i) => (i === si ? { ...s, title: e.target.value } : s)) } : d))
                  }
                  aria-label={`Section ${si + 1} name`}
                  className="serif text-base font-semibold text-gray-900 bg-transparent w-full focus:outline-none focus:ring-2 focus:ring-blue-500 rounded px-1"
                />
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
                      <button
                        type="button"
                        onClick={() => removeField(si, fi)}
                        aria-label={`Remove ${field.label}`}
                        className="px-2 py-2 text-gray-400 hover:text-red-600"
                      >
                        ✕
                      </button>
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
                    {field.helpText && <p className="text-xs text-gray-400">{field.helpText}</p>}
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
    </div>
  )
}
