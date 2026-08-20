"use client"
// components/documents/DocumentsBoard.tsx - every client's Pleadings and
// Correspondence in one list, with the two hand-filled columns editable in
// place (2026-08-20).
//
// The file name, date, link and folder are shown but NOT editable: those come
// from the Google Drive sync and the next sync would write over anything typed
// here. Only "Filed by" / "Sent by" and "Notes" are yours, so only those two
// have inputs. The rest is there so you know which document you are annotating.
import { useMemo, useState } from "react"
import { InlineError } from "@/components/ui/InlineError"
import { filedByColor, sentByColor, folderColor } from "@/lib/airtable-colors"
import type { DocBoardRow, DocKind } from "@/lib/doc-board"

const NAVY = "#1b2d45"

// How many rows are put on screen at once.
//
// The firm has well over a thousand documents across every case, and rendering
// all of them froze the page: React held ~1,650 cards in the DOM, so scrolling
// stuttered and clicks - including Edit - never landed. Every filter and every
// keystroke re-rendered the lot. Capping it is what the Field Notes hub already
// does, and the filters below are how you get to a specific document anyway.
const PAGE = 60

type SortKey = "client" | "date" | "missing"

const SORTS: { key: SortKey; label: string }[] = [
  { key: "client", label: "Client name" },
  { key: "date", label: "Newest first" },
  { key: "missing", label: "Missing who filed or sent it" },
]

// The same chips the client sees on their own Pleadings and Correspondence
// pages, from the same helpers, so a document looks identical wherever it is
// read. Correspondence and Pleadings use different palettes because the boards
// hold different choices: "Us"/"Them"/"Court" against "Plaintiff"/"Defendant".
function personChip(row: DocBoardRow) {
  return row.kind === "correspondence" ? sentByColor(row.person) : filedByColor(row.person)
}

// Soften the folder color into a row wash, exactly as PleadingsTable does, so
// everything from one Drive subfolder reads as a group without drowning the text.
function tint(hex: string, alpha = 0.5): string {
  const n = parseInt(hex.replace("#", ""), 16)
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`
}

function fmtDate(row: DocBoardRow): string {
  const d = row.date
  if (!d) return "no date on the file name"
  const [y, m, day] = d.split("-")
  return `${m}/${day}/${y}`
}

export default function DocumentsBoard({
  initialRows,
  loadError = false,
}: {
  initialRows: DocBoardRow[]
  loadError?: boolean
}) {
  const [rows, setRows] = useState<DocBoardRow[]>(initialRows)
  const [query, setQuery] = useState("")
  const [kind, setKind] = useState<DocKind | "">("")
  const [sortKey, setSortKey] = useState<SortKey>("client")
  const [onlyMissing, setOnlyMissing] = useState(false)
  const [shown, setShown] = useState(PAGE)

  // One row at a time, so there is never an ambiguous save.
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editPerson, setEditPerson] = useState("")
  const [editNotes, setEditNotes] = useState("")
  const [savingId, setSavingId] = useState<string | null>(null)
  const [rowError, setRowError] = useState<Record<string, string>>({})

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = rows.filter((r) => {
      if (kind && r.kind !== kind) return false
      if (onlyMissing && r.person.trim()) return false
      if (!q) return true
      return (
        r.title.toLowerCase().includes(q) ||
        r.clientLabel.toLowerCase().includes(q) ||
        r.notes.toLowerCase().includes(q) ||
        r.person.toLowerCase().includes(q)
      )
    })
    const sorted = [...list]
    if (sortKey === "client") {
      sorted.sort(
        (a, b) =>
          a.clientLabel.localeCompare(b.clientLabel) ||
          (b.date ?? b.created ?? "").localeCompare(a.date ?? a.created ?? "")
      )
    } else if (sortKey === "date") {
      sorted.sort((a, b) => (b.date ?? b.created ?? "").localeCompare(a.date ?? a.created ?? ""))
    } else {
      sorted.sort(
        (a, b) =>
          Number(Boolean(a.person.trim())) - Number(Boolean(b.person.trim())) ||
          a.clientLabel.localeCompare(b.clientLabel)
      )
    }
    return sorted
  }, [rows, query, kind, sortKey, onlyMissing])

  // Only this slice is rendered. `visible.length` still reports the true match
  // count, so the number above the list is the honest one.
  const paged = useMemo(() => visible.slice(0, shown), [visible, shown])

  const missingCount = rows.filter((r) => !r.person.trim()).length

  /**
   * The choices offered for "Filed by" / "Sent by", read from the data rather
   * than from Airtable's schema API.
   *
   * Two reasons. The portal's Airtable token is not guaranteed to carry
   * `schema.bases:read`, so asking for the field definition of forty separate
   * client bases may simply be refused. And more importantly these are single
   * select columns: writing a value that is not already an option makes
   * Airtable reject the save. Taking the options from values that are actually
   * stored means every choice offered is one that base already accepts,
   * character for character - which matters, because at least one of them
   * ("Them ") carries a trailing space on the board that a hand-typed list
   * would quietly lose.
   *
   * The consequence worth knowing: an option that exists on the board but has
   * never been used on any document will not appear here.
   */
  const choices = useMemo(() => {
    const byKind: Record<DocKind, Set<string>> = {
      pleadings: new Set<string>(),
      correspondence: new Set<string>(),
    }
    for (const r of rows) if (r.person.trim()) byKind[r.kind].add(r.person)
    return {
      pleadings: [...byKind.pleadings].sort((a, b) => a.localeCompare(b)),
      correspondence: [...byKind.correspondence].sort((a, b) => a.localeCompare(b)),
    }
  }, [rows])

  function startEdit(row: DocBoardRow) {
    setEditingId(row.recordId)
    setEditPerson(row.person)
    setEditNotes(row.notes)
    setRowError((p) => ({ ...p, [row.recordId]: "" }))
  }

  async function save(row: DocBoardRow) {
    setSavingId(row.recordId)
    setRowError((p) => ({ ...p, [row.recordId]: "" }))
    const res = await fetch("/api/admin/documents", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        baseId: row.baseId,
        kind: row.kind,
        recordId: row.recordId,
        person: editPerson,
        notes: editNotes,
        // Sent back as they were read, so a base that spells the column
        // "Filed By" is written back the same way. See lib/doc-board.
        personField: row.personField,
        notesField: row.notesField,
      }),
    }).catch(() => null)
    setSavingId(null)

    if (!res?.ok) {
      const data = (await res?.json().catch(() => null)) as { error?: string } | null
      setRowError((p) => ({
        ...p,
        [row.recordId]: data?.error || "Couldn't save that - nothing was changed. Try again.",
      }))
      return
    }
    setRows((prev) =>
      prev.map((r) =>
        // person is stored verbatim (see the API route: select options can
        // carry a trailing space), notes are tidied.
        r.recordId === row.recordId ? { ...r, person: editPerson, notes: editNotes.trim() } : r
      )
    )
    setEditingId(null)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setShown(PAGE) }}
          placeholder="Search by client, document, note…"
          aria-label="Search documents"
          className="flex-1 min-w-[14rem] px-4 py-2.5 text-sm bg-white border border-gray-300 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <select
          value={kind}
          onChange={(e) => { setKind(e.target.value as DocKind | ""); setShown(PAGE) }}
          aria-label="Document type"
          className="px-3 py-2.5 text-sm bg-white border border-gray-300 rounded-xl text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Pleadings and correspondence</option>
          <option value="pleadings">Pleadings only</option>
          <option value="correspondence">Correspondence only</option>
        </select>
        <select
          value={sortKey}
          onChange={(e) => { setSortKey(e.target.value as SortKey); setShown(PAGE) }}
          aria-label="Sort by"
          className="px-3 py-2.5 text-sm bg-white border border-gray-300 rounded-xl text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {SORTS.map((s) => (
            <option key={s.key} value={s.key}>
              Sort: {s.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => { setOnlyMissing((v) => !v); setShown(PAGE) }}
          className={`px-3.5 py-2 rounded-full text-xs font-semibold border ${onlyMissing ? "text-white border-transparent" : "bg-white text-gray-700 border-gray-300"}`}
          style={onlyMissing ? { background: "#9a3412" } : undefined}
        >
          {onlyMissing ? "Showing blanks only" : `No name on it (${missingCount})`}
        </button>
      </div>

      <p className="text-xs text-gray-400">
        {visible.length} of {rows.length} {rows.length === 1 ? "document" : "documents"}
        {visible.length > paged.length && ` · showing the first ${paged.length}`}
      </p>

      {loadError && (
        <p className="text-sm text-red-600 bg-white rounded-xl border border-red-200 p-4">
          The documents couldn&apos;t be loaded right now - refresh to try again.
        </p>
      )}

      {!loadError && visible.length === 0 && (
        <p className="text-sm text-gray-500 bg-white rounded-xl border border-gray-200 p-6">
          {rows.length === 0 ? "No documents on any client board yet." : "Nothing matches those filters."}
        </p>
      )}

      <div className="space-y-2">
        {paged.map((row) => {
          const editing = editingId === row.recordId
          const fc = row.folder ? folderColor(row.folder) : null
          const pc = personChip(row)
          return (
            <div
              key={`${row.baseId}-${row.recordId}`}
              className="rounded-xl border border-gray-200 p-4"
              style={{
                borderLeft: `4px solid ${row.kind === "pleadings" ? NAVY : "#7c6a52"}`,
                background: fc ? tint(fc.bg, 0.45) : "#FFFFFF",
              }}
            >
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <p className="text-sm font-semibold text-gray-900 min-w-0">
                  {row.clientLabel}
                  <span className="ml-2 text-[11px] font-medium uppercase tracking-wide text-gray-400">
                    {row.kind === "pleadings" ? "Pleading" : "Correspondence"}
                  </span>
                  {fc && row.folder && (
                    <span
                      className="ml-2 px-2 py-0.5 rounded-full text-[11px] font-semibold"
                      style={{ background: fc.bg, color: fc.text }}
                    >
                      {row.folder}
                    </span>
                  )}
                </p>
                <span className="shrink-0 text-xs text-gray-400">{fmtDate(row)}</span>
              </div>

              {/* Everything on this line comes from the Drive sync and is shown
                  for identification only. */}
              <p className="mt-1 text-sm text-gray-700">
                {row.title}
                {row.link && (
                  <a
                    href={row.link}
                    target="_blank"
                    rel="noreferrer"
                    className="ml-2 text-xs text-blue-600 underline hover:text-blue-800"
                  >
                    Open
                  </a>
                )}
              </p>

              {!editing ? (
                <div className="mt-2 flex flex-wrap items-baseline gap-x-6 gap-y-1">
                  <p className="text-[13px] flex items-center gap-1.5">
                    <span className="text-gray-400">
                      {row.kind === "pleadings" ? "Filed by" : "Sent by"}:
                    </span>
                    {row.person ? (
                      <span
                        className="px-2 py-0.5 rounded-full text-[11px] font-semibold"
                        style={{ background: pc.bg, color: pc.text }}
                      >
                        {row.person.replace(/\s+/g, " ").trim()}
                      </span>
                    ) : (
                      <span className="text-gray-300">not recorded</span>
                    )}
                  </p>
                  <p className="text-[13px] min-w-0">
                    <span className="text-gray-400">Notes: </span>
                    <span className={row.notes ? "text-gray-800" : "text-gray-300"}>
                      {row.notes || "none"}
                    </span>
                  </p>
                  <button
                    type="button"
                    onClick={() => startEdit(row)}
                    className="ml-auto text-xs text-gray-500 hover:text-gray-900 underline"
                  >
                    Edit
                  </button>
                </div>
              ) : (
                <div className="mt-3 space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label
                        htmlFor={`person-${row.recordId}`}
                        className="block text-xs font-semibold text-gray-500 mb-1"
                      >
                        {row.kind === "pleadings" ? "Filed by" : "Sent by"}
                      </label>
                      {/* The board's own choices. Tinted to the chip colour so
                          the menu reads the way the row does. */}
                      <select
                        id={`person-${row.recordId}`}
                        value={editPerson}
                        onChange={(e) => setEditPerson(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                        style={
                          editPerson
                            ? {
                                background:
                                  row.kind === "correspondence"
                                    ? sentByColor(editPerson).bg
                                    : filedByColor(editPerson).bg,
                                color:
                                  row.kind === "correspondence"
                                    ? sentByColor(editPerson).text
                                    : filedByColor(editPerson).text,
                              }
                            : { background: "#FFFFFF", color: "#111827" }
                        }
                      >
                        <option value="">- not recorded -</option>
                        {/* A value already on the record that is no longer an
                            offered choice still has to be selectable, or
                            opening the row would silently change it. */}
                        {editPerson && !choices[row.kind].includes(editPerson) && (
                          <option value={editPerson}>{editPerson.trim()}</option>
                        )}
                        {choices[row.kind].map((c) => (
                          <option key={c} value={c}>
                            {c.trim()}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label
                        htmlFor={`notes-${row.recordId}`}
                        className="block text-xs font-semibold text-gray-500 mb-1"
                      >
                        Notes
                      </label>
                      <input
                        id={`notes-${row.recordId}`}
                        type="text"
                        value={editNotes}
                        onChange={(e) => setEditNotes(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => save(row)}
                      disabled={savingId === row.recordId}
                      className="px-4 py-2 rounded-lg text-white text-sm font-semibold hover:opacity-90 disabled:opacity-60"
                      style={{ background: NAVY }}
                    >
                      {savingId === row.recordId ? "Saving…" : "Save"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      className="px-4 py-2 rounded-lg text-sm font-semibold bg-white border border-gray-300 text-gray-700"
                    >
                      Cancel
                    </button>
                    <span className="text-[11px] text-gray-400">
                      Saves to {row.clientLabel}&apos;s Airtable base. The file name, date and link
                      belong to the Drive sync and aren&apos;t editable.
                    </span>
                  </div>
                </div>
              )}

              {rowError[row.recordId] && (
                <InlineError
                  message={rowError[row.recordId]}
                  onRetry={editing ? () => void save(row) : undefined}
                />
              )}
            </div>
          )
        })}
      </div>

      {visible.length > paged.length && (
        <div className="flex items-center gap-3 flex-wrap">
          <button
            type="button"
            onClick={() => setShown((n) => n + PAGE)}
            className="text-sm underline text-gray-600 hover:text-gray-900"
          >
            Show {Math.min(PAGE, visible.length - paged.length)} more
          </button>
          <span className="text-xs text-gray-400">
            {visible.length - paged.length} not shown - search or filter to narrow it down.
          </span>
        </div>
      )}
    </div>
  )
}
