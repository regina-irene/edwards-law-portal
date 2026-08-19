"use client"
// components/notes/QuickNote.tsx - write a field note for any case from the
// Field Notes hub (2026-08-18).
//
// The hub is a search across every case; the composer only ever lived on one
// case's log, so the only way to write was to notice that a client's name was
// a link and click through. This puts the composer where the page already is:
// pick the case, write, save.
import { useState } from "react"
import { useRouter } from "next/navigation"
import { RichTextEditor } from "@/components/ui/RichTextEditor"
import ClientCombobox, { type ClientOption } from "@/components/admin/tasks/ClientCombobox"

export default function QuickNote({ clients }: { clients: ClientOption[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<string[]>([])
  const [draft, setDraft] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [savedFor, setSavedFor] = useState<string | null>(null)

  const clientId = selected[0] ?? ""
  const chosen = clients.find((c) => c.id === clientId)

  // Same emptiness rule the per-case composer uses: an image on its own counts.
  const hasContent = Boolean(draft.replace(/<[^>]*>/g, "").trim()) || /<img\b/i.test(draft)

  async function save() {
    if (!clientId) { setError("Pick which case this note belongs to."); return }
    if (!hasContent) { setError("Write something (or add an image) before saving."); return }
    setSaving(true)
    setError("")
    const res = await fetch("/api/admin/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId, body: draft }),
    }).catch(() => null)
    setSaving(false)
    if (!res?.ok) { setError("Couldn't save the note - nothing was written. Try again."); return }
    setSavedFor(chosen?.label ?? "that case")
    setDraft("")
    // Leave the case selected: notes usually come in twos and threes.
    router.refresh()
  }

  if (!open) {
    return (
      <div className="flex items-center gap-3 flex-wrap print:hidden">
        <button
          type="button"
          onClick={() => { setOpen(true); setSavedFor(null) }}
          className="px-4 py-2 rounded-lg text-white text-sm font-semibold hover:opacity-90"
          style={{ background: "#1b2d45" }}
        >
          ✍️ Write a field note
        </button>
        {savedFor && (
          <span className="text-sm text-green-700 font-medium">Saved to {savedFor} ✓</span>
        )}
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 print:hidden">
      <div className="flex items-center justify-between gap-3 mb-2">
        <p className="section-label">New field note</p>
        <button
          type="button"
          onClick={() => { setOpen(false); setError("") }}
          className="text-xs text-gray-400 hover:text-gray-700 underline"
        >
          Close
        </button>
      </div>

      <label className="block text-xs font-medium text-gray-600 mb-1">Which case?</label>
      <ClientCombobox
        clients={clients}
        selected={selected}
        onChange={(ids) => { setSelected(ids.slice(-1)); setError("") }}
      />

      <div className="mt-3">
        <RichTextEditor value={draft} onChange={setDraft} />
      </div>

      <div className="mt-3 flex items-center gap-3 flex-wrap">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="px-5 py-2 rounded-lg text-white text-sm font-semibold hover:opacity-90 disabled:opacity-60"
          style={{ background: "#1b2d45" }}
        >
          {saving ? "Saving…" : "Save note"}
        </button>
        {chosen && !error && !saving && (
          <span className="text-xs text-gray-500">Filing to {chosen.label}</span>
        )}
        {savedFor && !error && <span className="text-sm text-green-700 font-medium">Saved to {savedFor} ✓</span>}
        {error && <span className="text-sm text-red-600">{error}</span>}
      </div>
    </div>
  )
}
