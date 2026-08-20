"use client"
// components/notes/NotesTimeline.tsx - composer + merged timeline for one
// client's Field Notes. Manual notes are white cards with a navy edge (the
// "important" entries); portal events are lighter compact rows. Newest first.
import { useCallback, useRef, useState } from "react"
import { RichTextEditor } from "@/components/ui/RichTextEditor"
import { RichTextView } from "@/components/ui/RichTextView"
import { ConfirmDialog } from "@/components/ui/ConfirmDialog"
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

export default function NotesTimeline({
  clientId,
  initialItems,
  loadError = false,
  hiddenEventIds = [],
}: {
  clientId: string
  initialItems: TimelineItem[]
  loadError?: boolean
  /** Activity entries the firm has taken off the log. Nothing was deleted. */
  hiddenEventIds?: string[]
}) {
  const [items, setItems] = useState<TimelineItem[]>(initialItems)
  // Held here so hiding a row is instant, and reversible without a reload.
  const [hidden, setHidden] = useState<Set<string>>(() => new Set(hiddenEventIds))
  const [showHidden, setShowHidden] = useState(false)
  const [draft, setDraft] = useState("")
  const [saving, setSaving] = useState(false)
  const [notesOnly, setNotesOnly] = useState(false)
  const [author, setAuthor] = useState("")
  const [shown, setShown] = useState(PAGE)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState("")
  const [error, setError] = useState("")
  // Deleting a field note takes one confirm, and then it is actually gone.
  //
  // This used to hide the note for ten seconds and offer an undo, holding the
  // DELETE back until that window closed. It read well and behaved badly:
  // clicking through to another case inside those ten seconds unmounted the
  // banner, the DELETE never went out, and the note you believed you had
  // deleted was still on the file with nothing to say so. On a case log, a
  // delete that silently does not happen is worse than no undo. The dialog
  // names what is going; confirming it is the decision.
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
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
    // Nothing was hidden up front, so a failure costs the list nothing: the
    // note is still there and still on the file.
    if (!res?.ok) { setError("Couldn't delete the note - it's still on the file. Try again."); return }
    setItems((prev) => prev.filter((i) => !(i.type === "note" && i.note.id === id)))
  }, [])

  function askRemove(id: string) {
    setError("")
    setConfirmingId(id)
  }

  // Activity rows are drawn live from the conversation, the uploads, the tasks
  // and the forms - there is no row here to delete. So this HIDES: the entry
  // leaves the log and the message, document, task or response stays exactly
  // where it is. Reversible from "Show hidden".
  async function toggleHidden(eventId: string) {
    const wasHidden = hidden.has(eventId)
    // Move it straight away; put it back if the write fails.
    setHidden((prev) => {
      const next = new Set(prev)
      if (wasHidden) next.delete(eventId)
      else next.add(eventId)
      return next
    })
    setError("")
    const res = wasHidden
      ? await fetch(`/api/admin/timeline-hide?id=${encodeURIComponent(eventId)}`, { method: "DELETE" }).catch(() => null)
      : await fetch("/api/admin/timeline-hide", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ eventId }),
        }).catch(() => null)
    if (!res?.ok) {
      setHidden((prev) => {
        const next = new Set(prev)
        if (wasHidden) next.add(eventId)
        else next.delete(eventId)
        return next
      })
      setError(wasHidden ? "Couldn't restore that entry - try again." : "Couldn't hide that entry - try again.")
    }
  }

  // Everyone who wrote a note on this client, for the "written by" menu.
  const authors = Array.from(
    new Set(items.flatMap((i) => (i.type === "note" && i.note.author_name ? [i.note.author_name] : []))),
  ).sort((a, b) => a.localeCompare(b))

  // Picking a person implies "just my notes" - portal events have no author.
  const visible = items.filter((i) => {
    if (author) return i.type === "note" && i.note.author_name === author
    if (i.type === "event" && hidden.has(i.event.id) && !showHidden) return false
    return notesOnly ? i.type === "note" : true
  })
  const paged = visible.slice(0, shown)

  return (
    <div className="space-y-5 max-w-3xl">
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
        {hidden.size > 0 && (
          <button
            type="button"
            onClick={() => setShowHidden((v) => !v)}
            className="text-xs text-gray-400 hover:text-gray-700 underline"
          >
            {showHidden ? "Hide them again" : `Show ${hidden.size} hidden`}
          </button>
        )}
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
            <div
              key={item.event.id}
              className={`group flex items-baseline gap-2.5 px-4 py-2 rounded-lg ${hidden.has(item.event.id) ? "opacity-60" : ""}`}
              style={{ background: "rgba(255,255,255,0.55)" }}
            >
              <span className="text-sm">{EVENT_ICONS[item.event.kind] ?? "•"}</span>
              <p className="text-[13px] text-gray-600 min-w-0 flex-1">
                {item.event.detail}
                <span className="text-gray-400"> · {fmt(item.at)}</span>
                {hidden.has(item.event.id) && (
                  <span className="ml-2 text-[10px] uppercase tracking-wide text-gray-400">hidden</span>
                )}
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
              {/* "Hide", never "Delete": the message, file, task or response
                  this line describes is not touched. */}
              <button
                type="button"
                onClick={() => void toggleHidden(item.event.id)}
                className="shrink-0 opacity-0 group-hover:opacity-100 focus:opacity-100 text-[11px] text-gray-400 hover:text-gray-800 underline print:hidden"
              >
                {hidden.has(item.event.id) ? "Restore" : "Hide"}
              </button>
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
        body="This note is only kept here - deleting it removes it from the case log for good."
        confirmLabel="Delete note"
        onConfirm={() => { const id = confirmingId; setConfirmingId(null); if (id) void runDelete(id) }}
        onCancel={() => setConfirmingId(null)}
      />
    </div>
  )
}
