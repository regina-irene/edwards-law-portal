"use client"
// components/discovery/DiscoveryBoard.tsx - every client's Discovery table in
// one editable list (2026-08-20).
//
// Unlike the Documents board, nothing here comes from the Drive sync, so every
// column is editable. The one to be careful with is "Avail. to Client": it is
// the gate that decides whether a row appears on that client's own Discovery
// page. It is shown as a plain switch on every row, not buried in the editor,
// because whether a client can see a document is the thing you most often want
// to check and change.
import { useMemo, useState } from "react"
import { InlineError } from "@/components/ui/InlineError"
import { chipFromColorName } from "@/lib/airtable-colors"
import DriveFolderPeek from "@/components/discovery/DriveFolderPeek"
import { isDriveFolderLink } from "@/lib/drive-folder-link"
import type { DiscoveryBoardRow, DiscoveryChoicesByBase } from "@/lib/discovery-board"

const NAVY = "#1b2d45"

// Same reason as the Documents board: rendering every row at once locks the page.
const PAGE = 50

type SortKey = "client" | "date" | "hidden"

const SORTS: { key: SortKey; label: string }[] = [
  { key: "client", label: "Client name" },
  { key: "date", label: "Newest first" },
  { key: "hidden", label: "Hidden from the client first" },
]

function fmtDate(d: string | null): string {
  if (!d) return "no date"
  const [y, m, day] = d.split("-")
  return `${m}/${day}/${y}`
}

export default function DiscoveryBoard({
  initialRows,
  choices,
  loadError = false,
}: {
  initialRows: DiscoveryBoardRow[]
  /** Direction and Tag options, per client base. Never pooled across clients. */
  choices: DiscoveryChoicesByBase
  loadError?: boolean
}) {
  const [rows, setRows] = useState<DiscoveryBoardRow[]>(initialRows)
  const [query, setQuery] = useState("")
  const [sortKey, setSortKey] = useState<SortKey>("client")
  const [onlyHidden, setOnlyHidden] = useState(false)
  const [shown, setShown] = useState(PAGE)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState<Partial<DiscoveryBoardRow>>({})
  const [savingId, setSavingId] = useState<string | null>(null)
  const [rowError, setRowError] = useState<Record<string, string>>({})

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = rows.filter((r) => {
      if (onlyHidden && r.available) return false
      if (!q) return true
      return (
        r.name.toLowerCase().includes(q) ||
        r.clientLabel.toLowerCase().includes(q) ||
        r.notes.toLowerCase().includes(q) ||
        r.tags.some((t) => t.toLowerCase().includes(q))
      )
    })
    const sorted = [...list]
    if (sortKey === "client") {
      sorted.sort(
        (a, b) => a.clientLabel.localeCompare(b.clientLabel) || (b.date ?? "").localeCompare(a.date ?? "")
      )
    } else if (sortKey === "date") {
      sorted.sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""))
    } else {
      sorted.sort(
        (a, b) =>
          Number(a.available) - Number(b.available) || a.clientLabel.localeCompare(b.clientLabel)
      )
    }
    return sorted
  }, [rows, query, sortKey, onlyHidden])

  const paged = useMemo(() => visible.slice(0, shown), [visible, shown])
  const hiddenCount = rows.filter((r) => !r.available).length

  const choicesFor = (row: DiscoveryBoardRow) =>
    choices[row.baseId] ?? { direction: [], tags: [] }
  const colorOf = (row: DiscoveryBoardRow, which: "direction" | "tags", value: string) =>
    choicesFor(row)[which].find((c) => c.name === value)?.color

  function startEdit(row: DiscoveryBoardRow) {
    setEditingId(row.recordId)
    setDraft({
      name: row.name,
      date: row.date,
      direction: row.direction,
      tags: row.tags,
      notes: row.notes,
      url: row.url,
    })
    setRowError((p) => ({ ...p, [row.recordId]: "" }))
  }

  /**
   * Send one or more fields. Used both by the editor's Save and by the
   * availability switch, which patches a single field on its own so a client's
   * view can be changed without opening the row.
   */
  async function patch(row: DiscoveryBoardRow, fields: Record<string, unknown>): Promise<boolean> {
    setSavingId(row.recordId)
    setRowError((p) => ({ ...p, [row.recordId]: "" }))
    const res = await fetch("/api/admin/discovery", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        baseId: row.baseId,
        recordId: row.recordId,
        fieldNames: row.fieldNames,
        ...fields,
      }),
    }).catch(() => null)
    setSavingId(null)
    if (!res?.ok) {
      const data = (await res?.json().catch(() => null)) as { error?: string } | null
      setRowError((p) => ({
        ...p,
        [row.recordId]: data?.error || "Couldn't save that - nothing was changed. Try again.",
      }))
      return false
    }
    return true
  }

  async function save(row: DiscoveryBoardRow) {
    const fields = {
      name: draft.name ?? "",
      date: draft.date ?? null,
      direction: draft.direction ?? "",
      tags: draft.tags ?? [],
      notes: draft.notes ?? "",
      url: draft.url ?? "",
    }
    if (!(await patch(row, fields))) return
    setRows((prev) =>
      prev.map((r) => (r.recordId === row.recordId ? { ...r, ...fields, date: fields.date } : r))
    )
    setEditingId(null)
  }

  async function toggleAvailable(row: DiscoveryBoardRow) {
    const next = !row.available
    // Move it first so the switch feels immediate, and put it back on failure.
    setRows((prev) => prev.map((r) => (r.recordId === row.recordId ? { ...r, available: next } : r)))
    if (!(await patch(row, { available: next }))) {
      setRows((prev) =>
        prev.map((r) => (r.recordId === row.recordId ? { ...r, available: !next } : r))
      )
    }
  }

  function toggleTag(row: DiscoveryBoardRow, tag: string) {
    setDraft((d) => {
      const current = d.tags ?? []
      return { ...d, tags: current.includes(tag) ? current.filter((t) => t !== tag) : [...current, tag] }
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setShown(PAGE) }}
          placeholder="Search by client, document, tag, note…"
          aria-label="Search discovery"
          className="flex-1 min-w-[14rem] px-4 py-2.5 text-sm bg-white border border-gray-300 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
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
          onClick={() => { setOnlyHidden((v) => !v); setShown(PAGE) }}
          className={`px-3.5 py-2 rounded-full text-xs font-semibold border ${onlyHidden ? "text-white border-transparent" : "bg-white text-gray-700 border-gray-300"}`}
          style={onlyHidden ? { background: "#9a3412" } : undefined}
        >
          {onlyHidden ? "Showing hidden only" : `Hidden from clients (${hiddenCount})`}
        </button>
      </div>

      <p className="text-xs text-gray-400">
        {visible.length} of {rows.length} {rows.length === 1 ? "item" : "items"}
        {visible.length > paged.length && ` · showing the first ${paged.length}`}
      </p>

      {loadError && (
        <p className="text-sm text-red-600 bg-white rounded-xl border border-red-200 p-4">
          Discovery couldn&apos;t be loaded right now - refresh to try again.
        </p>
      )}

      {!loadError && visible.length === 0 && (
        <p className="text-sm text-gray-500 bg-white rounded-xl border border-gray-200 p-6">
          {rows.length === 0 ? "No discovery on any client board yet." : "Nothing matches those filters."}
        </p>
      )}

      <div className="space-y-2">
        {paged.map((row) => {
          const editing = editingId === row.recordId
          const dc = colorOf(row, "direction", row.direction)
          return (
            <div
              // clientId too: two clients (opposing parties in one matter) can
              // share a base, which would otherwise collide on the same record.
              key={`${row.clientId}-${row.baseId}-${row.recordId}`}
              className={`rounded-xl border border-gray-200 p-4 ${row.available ? "bg-white" : "bg-gray-50"}`}
              style={{ borderLeft: `4px solid ${row.available ? NAVY : "#cbd5e1"}` }}
            >
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <p className="text-sm font-semibold text-gray-900 min-w-0">
                  {row.clientLabel}
                  {row.direction && (
                    <span
                      className="ml-2 px-2 py-0.5 rounded-full text-[11px] font-semibold"
                      style={
                        dc
                          ? { background: chipFromColorName(dc).bg, color: chipFromColorName(dc).text }
                          : { background: "#eef2f7", color: NAVY }
                      }
                    >
                      {row.direction.trim()}
                    </span>
                  )}
                </p>
                <span className="shrink-0 text-xs text-gray-400">{fmtDate(row.date)}</span>
              </div>

              <p className="mt-1 text-sm text-gray-700">
                {row.name || <span className="text-gray-300">no name</span>}
                {row.url && (
                  <a
                    href={row.url}
                    target="_blank"
                    rel="noreferrer"
                    className="ml-2 text-xs text-blue-600 underline hover:text-blue-800"
                  >
                    Open
                  </a>
                )}
              </p>

              {row.tags.length > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {row.tags.map((t) => {
                    const tc = colorOf(row, "tags", t)
                    return (
                      <span
                        key={t}
                        className="px-2 py-0.5 rounded-full text-[11px] font-semibold"
                        style={
                          tc
                            ? { background: chipFromColorName(tc).bg, color: chipFromColorName(tc).text }
                            : { background: "#eef2f7", color: NAVY }
                        }
                      >
                        {t.trim()}
                      </span>
                    )
                  })}
                </div>
              )}

              {row.notes && !editing && <p className="mt-1.5 text-[13px] text-gray-600">{row.notes}</p>}

              {isDriveFolderLink(row.url) && !editing && (
                <div className="mt-2">
                  <DriveFolderPeek recordId={row.recordId} baseId={row.baseId} />
                </div>
              )}

              {/* The gate. Deliberately on the row, not inside the editor. */}
              <div className="mt-2.5 flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-2 text-xs cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={row.available}
                    disabled={savingId === row.recordId}
                    onChange={() => void toggleAvailable(row)}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  <span className={row.available ? "text-gray-800 font-medium" : "text-gray-500"}>
                    {row.available ? "The client can see this" : "Hidden from the client"}
                  </span>
                </label>
                {!editing && (
                  <button
                    type="button"
                    onClick={() => startEdit(row)}
                    className="ml-auto text-xs text-gray-500 hover:text-gray-900 underline"
                  >
                    Edit
                  </button>
                )}
              </div>

              {editing && (
                <div className="mt-3 space-y-3 border-t border-gray-200 pt-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="md:col-span-2">
                      <label className="block text-xs font-semibold text-gray-500 mb-1">Document</label>
                      <input
                        type="text"
                        value={draft.name ?? ""}
                        onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1">Date</label>
                      <input
                        type="date"
                        value={draft.date ?? ""}
                        onChange={(e) => setDraft((d) => ({ ...d, date: e.target.value || null }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1">
                        Incoming or outgoing
                      </label>
                      <select
                        value={draft.direction ?? ""}
                        onChange={(e) => setDraft((d) => ({ ...d, direction: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">- not set -</option>
                        {draft.direction &&
                          !choicesFor(row).direction.some((c) => c.name === draft.direction) && (
                            <option value={draft.direction}>{draft.direction.trim()}</option>
                          )}
                        {choicesFor(row).direction.map((c) => (
                          <option key={c.name} value={c.name}>
                            {c.name.trim()}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-xs font-semibold text-gray-500 mb-1">Link</label>
                      <input
                        type="url"
                        value={draft.url ?? ""}
                        onChange={(e) => setDraft((d) => ({ ...d, url: e.target.value }))}
                        placeholder="https://drive.google.com/drive/folders/…"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <span className="text-[11px] text-gray-400">
                        A Drive folder link gets a &quot;what&apos;s inside&quot; list on the
                        client&apos;s page.
                      </span>
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-xs font-semibold text-gray-500 mb-1">Notes</label>
                      <input
                        type="text"
                        value={draft.notes ?? ""}
                        onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  {choicesFor(row).tags.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-gray-500 mb-1.5">Tags</p>
                      <div className="flex flex-wrap gap-1.5">
                        {choicesFor(row).tags.map((c) => {
                          const on = (draft.tags ?? []).includes(c.name)
                          const chip = c.color ? chipFromColorName(c.color) : null
                          return (
                            <button
                              key={c.name}
                              type="button"
                              onClick={() => toggleTag(row, c.name)}
                              className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border ${on ? "border-transparent" : "border-gray-300 bg-white text-gray-600"}`}
                              style={on && chip ? { background: chip.bg, color: chip.text } : undefined}
                            >
                              {c.name.trim()}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )}

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
                      Saves to {row.clientLabel}&apos;s Airtable base.
                    </span>
                  </div>
                </div>
              )}

              {rowError[row.recordId] && <InlineError message={rowError[row.recordId]} />}
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
