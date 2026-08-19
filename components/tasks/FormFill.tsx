"use client"

import { useEffect, useState } from "react"

interface FormField {
  id: string
  fieldKey: string
  label: string
  type: string
  placeholder: string | null
  helpText: string | null
  required: boolean
  width: string | null
  options: { value: string; label: string }[] | null
}
interface FormSection {
  id: string
  title: string
  description: string | null
  fields: FormField[]
}
interface FormDefinition {
  key: string
  label: string
  description: string | null
  sections: FormSection[]
}

// `readOnly` means the client's case is closed: their answers stay visible, but
// nothing can be changed or submitted.
export default function FormFill({ formKey, readOnly = false }: { formKey: string; readOnly?: boolean }) {
  const [form, setForm] = useState<FormDefinition | null>(null)
  const [values, setValues] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Required questions still waiting on an answer, flagged after a save.
  const [missing, setMissing] = useState<string[]>([])

  useEffect(() => {
    fetch(`/api/forms/${encodeURIComponent(formKey)}`)
      .then(async (r) => {
        if (!r.ok) throw new Error("load")
        return r.json()
      })
      .then((d) => { setForm(d.form); setValues(d.values ?? {}) })
      .catch(() => setError("This form could not be loaded."))
      .finally(() => setLoading(false))
  }, [formKey])

  function set(fieldKey: string, value: string) {
    setValues((p) => ({ ...p, [fieldKey]: value }))
    setSaved(false)
  }

  // A required question must be answered - a checkbox must be ticked, anything
  // else must be non-empty.
  function isAnswered(field: FormField, value: string): boolean {
    return field.type === "checkbox" ? value === "true" : (value ?? "").trim() !== ""
  }

  async function save() {
    if (readOnly) return
    setSaving(true)
    setError(null)
    const res = await fetch(`/api/forms/${encodeURIComponent(formKey)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ values }),
    })
    setSaving(false)
    if (!res.ok) { setError("Could not save. Please try again."); return }

    // Progress is always saved first - a long form is too much work to lose - 
    // then anything still required is flagged rather than silently accepted.
    const unanswered = (form?.sections ?? [])
      .flatMap((s) => s.fields)
      .filter((f) => f.required && !isAnswered(f, values[f.fieldKey] ?? ""))
      .map((f) => f.fieldKey)
    setMissing(unanswered)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  if (loading) return <p className="text-sm text-gray-400">Loading form…</p>
  if (error && !form) return <p className="text-sm text-red-500">{error}</p>
  if (!form) return null

  return (
    <div className="space-y-5">
      {form.description && <p className="text-sm text-gray-500">{form.description}</p>}
      {form.sections.map((section) => (
        <div key={section.id} className="space-y-3">
          <div>
            <h4 className="text-sm font-semibold text-gray-800">{section.title}</h4>
            {section.description && <p className="text-xs text-gray-500">{section.description}</p>}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {section.fields.map((f) => (
              <Field
                key={f.id}
                field={f}
                value={values[f.fieldKey] ?? ""}
                onChange={(v) => set(f.fieldKey, v)}
                flagged={missing.includes(f.fieldKey)}
                disabled={readOnly}
              />
            ))}
          </div>
        </div>
      ))}
      <div className="flex items-center gap-3 pt-2 border-t border-gray-200 flex-wrap">
        <button onClick={save} disabled={saving || readOnly} className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50">
          {saving ? "Saving…" : "Save answers"}
        </button>
        {readOnly && (
          <span className="text-xs text-gray-500">
            Your case is closed, so this form can no longer be changed. Your answers are still here.
          </span>
        )}
        {saved && missing.length === 0 && <span className="text-xs text-green-600 font-medium">Saved ✓</span>}
        {error && <span className="text-xs text-red-500">{error}</span>}
      </div>

      {missing.length > 0 && (
        <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          Your answers are saved. {missing.length} required {missing.length === 1 ? "question still needs" : "questions still need"} an
          answer - they&apos;re marked in red above. You can come back and finish any time.
        </p>
      )}
    </div>
  )
}

function Field({
  field,
  value,
  onChange,
  flagged = false,
  disabled = false,
}: {
  field: FormField
  value: string
  onChange: (v: string) => void
  // True when this required question was left blank at the last save.
  flagged?: boolean
  // True while the client's case is closed: readable, not editable.
  disabled?: boolean
}) {
  const full = field.width !== "half"
  const base = `w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
    flagged ? "border-red-400 bg-red-50" : "border-gray-300"
  }${disabled ? " bg-gray-50 text-gray-600" : ""}`
  const label = (
    <label className={`block text-xs font-medium mb-1 ${flagged ? "text-red-700" : "text-gray-600"}`}>
      {field.label}{field.required && <span className="text-red-500"> *</span>}
      {flagged && <span className="ml-1 font-normal"> - needs an answer</span>}
    </label>
  )

  let input
  if (field.type === "textarea") {
    input = <textarea value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} placeholder={field.placeholder ?? ""} rows={3} className={`${base} resize-none`} />
  } else if (field.type === "select") {
    input = (
      <select value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} className={base}>
        <option value="">Select…</option>
        {(field.options ?? []).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    )
  } else if (field.type === "radio") {
    input = (
      <div className="flex flex-wrap gap-3 pt-1">
        {(field.options ?? []).map((o) => (
          <label key={o.value} className="flex items-center gap-1.5 text-sm text-gray-700">
            <input type="radio" name={field.fieldKey} checked={value === o.value} disabled={disabled} onChange={() => onChange(o.value)} />
            {o.label}
          </label>
        ))}
      </div>
    )
  } else if (field.type === "checkbox") {
    return (
      <div className={full ? "sm:col-span-2" : ""}>
        <label className={`flex items-center gap-2 text-sm ${flagged ? "text-red-700" : "text-gray-700"}`}>
          <input type="checkbox" checked={value === "true"} disabled={disabled} onChange={(e) => onChange(e.target.checked ? "true" : "false")} />
          {field.label}{field.required && <span className="text-red-500"> *</span>}
          {flagged && <span className="font-normal"> - needs an answer</span>}
        </label>
        {field.helpText && <p className="text-xs text-gray-400 mt-0.5">{field.helpText}</p>}
      </div>
    )
  } else {
    const type = ["email", "tel", "date", "number"].includes(field.type) ? field.type : field.type === "currency" ? "number" : "text"
    input = <input type={type} value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} placeholder={field.placeholder ?? ""} className={base} />
  }

  return (
    <div className={full ? "sm:col-span-2" : ""}>
      {label}
      {input}
      {field.helpText && <p className="text-xs text-gray-400 mt-0.5">{field.helpText}</p>}
    </div>
  )
}
