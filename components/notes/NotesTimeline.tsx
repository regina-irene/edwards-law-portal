"use client"
// components/notes/NotesTimeline.tsx - composer + merged timeline for one
// client's Field Notes. Manual notes are white cards with a navy edge (the
// "important" entries); portal events are lighter compact rows. Newest first.
import { useCallback, useRef, useState } from "react"
import { RichTextEditor } from "@/components/ui/RichTextEditor"
import { RichTextView } from "@/components/ui/RichTextView"
import { ConfirmDialog } from "@/components/ui/ConfirmDialog"
import { UndoBanner } from "@/components/ui/UndoBanner"
import type { TimelineItem } from "@/lib/notes-timeline"
import type { ClientNote } from "@/lib/notes"

const EVENT_ICONS: Record<string, string> = { chat: "💬", message: "💬", upload: "📎", form: "📋", task: "✅", view: "👁️" }
const PAGE = 200

function fmt(at: string): string {
  return new Date(at).toLocaleString("en-US", {
    timeZone: "America/New_York",
    month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit",
  })
}

export default function NotesTimeline({ clientId, initialItems, loadError = false }: { clientId: string; initialItems: TimelineItem[]; loadError?: boolean }) {
  const [items, setItems] = useState<TimelineItem[]>(initialItems)
  const [draft, setDraft] = useState("")
  const [saving, setSaving] = useState(false)
  const [notesOnly, setNotesOnly] = useState(false)
  const [author, setAuthor] = useState("")
  const [shown, setShown] = useState(PAGE)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState("")
  const [error, setError] = useState("")
  // Deleting a field note can't be taken back, so it happens in two beats: the
  // confirm names what's going, then the note is hidden for ten seconds while
  // the undo is on offer. The DELETE only goes out when that window closes.
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const deletingRef = useRef<string | null>(null)

  async function save() {
    const hasText = Boolean(draft.replace(/<[^>]*>/g, "").trim())
    const hasImage = /<img\b/i.test(draft)
    if (!hasText && !hasImage) { setError("Write something (or add an image) before saving.") ; return }
    setSaving(true)
    setError("")
    const res = await fetch("/api/admin/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId, body: draft }),
    }).catch(() => null)
    setSaving(false)
    if (!res?.ok) { setError("Couldn't save the note - try again."); return }
    const { note } = (await res.json()) as { note: ClientNote }
    setItems([{ type: "note", at: note.created_at, note }, ...items])
    setDraft("")
  }

  async function saveEdit(id: string) {
    const res = await fetch("/api/admin/notes", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, body: editDraft }),
    }).catch(() => null)
    if (!res?.ok) { setError("Couldn't update the note - try again."); return }
    const { note } = (await res.json()) as { note: ClientNote }
    setItems(items.map((i) => (i.type === "note" && i.note.id === id ? { ...i, note } : i)))
    setEditingId(null)
  }

  // Guarded by a ref so the countdown firing twice can't send two DELETEs.
  const runDelete = useCallback(async (id: string) => {
    if (deletingRef.current === id) return
    deletingRef.current = id
    const res = await fetch(`/api/admin/notes?id=${encodeURIComponent(id)}`, { method: "DELETE" }).catch(() => null)
    deletingRef.current = null
    setPendingDeleteId(null)
    // On a failure the note simply comes back into the list - nothing is lost.
    if (!res?.ok) { setError("Couldn't delete the note - try again."); return }
    setItems((prev) => prev.filter((i) => !(i.type === "note" && i.note.id === id)))
  }, [])

  const commitPendingDelete = useCallback(() => {
    if (pendingDeleteId) void runDelete(pendingDeleteId)
  }, [pendingDeleteId, runDelete])

  function askRemove(id: string) {
    // Only one note can be waiting at a time - see the other one out first.
    commitPendingDelete()
    setError("")
    setConfirmingId(id)
  }

  // Everyone who wrote a note on this client, for the "written by" menu.
  const authors = Array.from(
    new Set(items.flatMap((i) => (i.type === "note" && i.note.author_name ? [i.note.author_name] : []))),
  ).sort((a, b) => a.localeCompare(b))

  // Picking a person implies "just my notes" - portal events have no author.
  const visible = items.filter((i) => {
    if (pendingDeleteId && i.type === "note" && i.note.id === pendingDeleteId) return false
    if (author) return i.type === "note" && i.note.author_name === author
    return notesOnly ? i.type === "note" : true
  })
  const paged = visible.slice(0, shown)

  return (
    <div className="space-y-5 max-w-3xl">
      {pendingDeleteId && (
        <div className="print:hidden">
          <UndoBanner
            key={pendingDeleteId}
            message="Note deleted"
            onUndo={() => setPendingDeleteId(null)}
            onDismiss={commitPendingDelete}
          />
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 p-4 print:hidden">
        <p className="section-label mb-2">New note</p>
        <RichTextEditor value={draft} onChange={setDraft} />
        <div className="mt-3 flex items-center gap-3">
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="px-5 py-2 rounded-lg text-white text-sm font-semibold hover:opacity-90 disabled:opacity-60"
            style={{ background: "#1b2d45" }}
          >
            {saving ? "Saving…" : "Save note"}
          </button>
          {error && <span className="text-sm text-red-600">{error}</span>}
        </div>
      </div>

      <div className="flex items-center gap-2 print:hidden">
        <button
          type="button"
          onClick={() => setNotesOnly(false)}
          className={`px-3.5 py-1.5 rounded-full text-xs font-semibold border ${!notesOnly ? "text-white border-transparent" : "bg-white text-gray-700 border-gray-300"}`}
          style={!notesOnly ? { background: "#1b2d45" } : undefined}
        >
          Everything
        </button>
        <button
          type="button"
          onClick={() => setNotesOnly(true)}
          className={`px-3.5 py-1.5 rounded-full text-xs font-semibold border ${notesOnly ? "text-white border-transparent" : "bg-white text-gray-700 border-gray-300"}`}
          style={notesOnly ? { background: "#1b2d45" } : undefined}
        >
          Just my notes
        </button>
        {authors.length > 0 && (
          <label className="ml-auto flex items-center gap-2 text-xs text-gray-500">
            Written by
            <select
              value={author}
              onChange={(e) => { setAuthor(e.target.value); setShown(PAGE) }}
              className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-white border border-gray-300 text-gray-700"
            >
              <option value="">Anyone</option>
              {authors.map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </label>
        )}
      </div>

      {loadError && (
        <p className="text-sm text-red-600 bg-white rounded-xl border border-red-200 p-4">Notes couldn&apos;t be loaded right now - refresh to try again. (New notes may not appear below.)</p>
      )}

      {!loadError && paged.length === 0 && (
        <p className="text-sm text-gray-500 bg-white rounded-xl border border-gray-200 p-6">No notes yet - write the first one.</p>
      )}

      <div className="space-y-3">
        {paged.map((item) =>
          item.type === "note" ? (
            <div key={item.note.id} className="bg-white rounded-xl border border-gray-200 p-4" style={{ borderLeft: "4px solid #1b2d45" }}>
              <div className="flex items-center justify-between gap-3 mb-1.5">
                <p className="text-xs font-semibold" style={{ color: "#1b2d45" }}>
                  📌 {fmt(item.at)}
                  {item.note.author_name && <span className="font-normal text-gray-500"> · {item.note.author_name}</span>}
                  {item.note.updated_at && <span className="font-normal text-gray-400"> · edited</span>}
                </p>
                <span className="flex gap-2 print:hidden">
                  <button type="button" className="text-xs text-gray-400 hover:text-gray-700 underline" onClick={() => { setEditingId(item.note.id); setEditDraft(item.note.body) }}>Edit</button>
                  <button type="button" className="text-xs text-gray-400 hover:text-red-600 underline" onClick={() => askRemove(item.note.id)}>Delete</button>
                </span>
              </div>
              {editingId === item.note.id ? (
                <div>
                  <RichTextEditor value={editDraft} onChange={setEditDraft} />
                  <div className="mt-2 flex gap-2">
                    <button type="button" className="px-3 py-1.5 rounded-lg text-white text-xs font-semibold" style={{ background: "#1b2d45" }} onClick={() => saveEdit(item.note.id)}>Save</button>
                    <button type="button" className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white border border-gray-300 text-gray-700" onClick={() => setEditingId(null)}>Cancel</button>
                  </div>
                </div>
              ) : (
                <RichTextView html={item.note.body} />
              )}
            </div>
          ) : (
            <div key={item.event.id} className="flex items-baseline gap-2.5 px-4 py-2 rounded-lg" style={{ background: "rgba(255,255,255,0.55)" }}>
              <span className="text-sm">{EVENT_ICONS[item.event.kind] ?? "•"}</span>
              <p className="text-[13px] text-gray-600 min-w-0">
                {item.event.detail}
                <span className="text-gray-400"> · {fmt(item.at)}</span>
                {item.event.href && (
                  <a
                    href={item.event.href}
                    target="_blank"
                    rel="noreferrer"
                    className="ml-2 text-blue-600 underline hover:text-blue-800 print:hidden"
                  >
                    {item.event.linkLabel ?? "Open file"}
                  </a>
                )}
              </p>
            </div>
          )
        )}
      </div>

      {visible.length > shown && (
        <button type="button" onClick={() => setShown(shown + PAGE)} className="print:hidden text-sm underline text-gray-600 hover:text-gray-900">
          Show older
        </button>
      )}

      <ConfirmDialog
        open={confirmingId !== null}
        title="Delete this note?"
        body="This note is only kept here - deleting it removes it from the case log for good. You'll have ten seconds to undo."
        confirmLabel="Delete note"
        onConfirm={() => { setPendingDeleteId(confirmingId); setConfirmingId(null) }}
        onCancel={() => setConfirmingId(null)}
      />
    </div>
  )
}
