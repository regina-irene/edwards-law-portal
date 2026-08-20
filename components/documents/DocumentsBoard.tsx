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
import type { DocBoardRow, DocKind } from "@/lib/doc-board"

const NAVY = "#1b2d45"

type SortKey = "client" | "date" | "missing"

const SORTS: { key: SortKey; label: string }[] = [
  { key: "client", label: "Client name" },
  { key: "date", label: "Newest first" },
  { key: "missing", label: "Missing who filed or sent it" },
]

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

  const missingCount = rows.filter((r) => !r.person.trim()).length

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
        r.recordId === row.recordId ? { ...r, person: editPerson.trim(), notes: editNotes.trim() } : r
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
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by client, document, note…"
          aria-label="Search documents"
          className="flex-1 min-w-[14rem] px-4 py-2.5 text-sm bg-white border border-gray-300 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value as DocKind | "")}
          aria-label="Document type"
          className="px-3 py-2.5 text-sm bg-white border border-gray-300 rounded-xl text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Pleadings and correspondence</option>
          <option value="pleadings">Pleadings only</option>
          <option value="correspondence">Correspondence only</option>
        </select>
        <select
          value={sortKey}
          onChange={(e) => setSortKey(e.target.value as SortKey)}
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
          onClick={() => setOnlyMissing((v) => !v)}
          className={`px-3.5 py-2 rounded-full text-xs font-semibold border ${onlyMissing ? "text-white border-transparent" : "bg-white text-gray-700 border-gray-300"}`}
          style={onlyMissing ? { background: "#9a3412" } : undefined}
        >
          {onlyMissing ? "Showing blanks only" : `No name on it (${missingCount})`}
        </button>
      </div>

      <p className="text-xs text-gray-400">
        {visible.length} of {rows.length} {rows.length === 1 ? "document" : "documents"}
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
        {visible.map((row) => {
          const editing = editingId === row.recordId
          return (
            <div
              key={`${row.baseId}-${row.recordId}`}
              className="bg-white rounded-xl border border-gray-200 p-4"
              style={{ borderLeft: `4px solid ${row.kind === "pleadings" ? NAVY : "#7c6a52"}` }}
            >
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <p className="text-sm font-semibold text-gray-900 min-w-0">
                  {row.clientLabel}
                  <span className="ml-2 text-[11px] font-medium uppercase tracking-wide text-gray-400">
                    {row.kind === "pleadings" ? "Pleading" : "Correspondence"}
                  </span>
                  {row.folder && (
                    <span
                      className="ml-2 px-2 py-0.5 rounded-full text-[11px] font-semibold"
                      style={{ background: "#eef2f7", color: NAVY }}
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
                  <p className="text-[13px]">
                    <span className="text-gray-400">
                      {row.kind === "pleadings" ? "Filed by" : "Sent by"}:{" "}
                    </span>
                    <span className={row.person ? "text-gray-800" : "text-gray-300"}>
                      {row.person || "not recorded"}
                    </span>
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
                      <input
                        id={`person-${row.recordId}`}
                        type="text"
                        value={editPerson}
                        onChange={(e) => setEditPerson(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
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
    </div>
  )
}
