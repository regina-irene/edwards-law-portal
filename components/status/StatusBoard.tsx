"use client"
// components/status/StatusBoard.tsx - the admin Status board. Every client, the
// stage their case is at, and BOTH status write-ups - editable in place.
//
// Two columns on the Airtable board, and only one of them reaches a client
// (2026-08-20):
//   Internal note   "Case Status - Dashboard".  Yours. Never leaves this screen.
//   Client-facing   "Case Status - For Client". Exactly what the client reads.
//
// They are drawn side by side, in different colours, and every label says which
// is which. Getting these two confused is the one mistake this screen must make
// hard to make, because one direction of the mistake puts internal wording in
// front of a client.
//
// Everything here is admin-only. Payment status and the judge are deliberately
// absent from the board.
//
// This is a client component, so it imports no server-only helper from
// lib/case-status (that module pulls in next/cache). Types are type-only
// imports, the stage vocabulary arrives as a prop, and the one bit of logic it
// needs on its own - the stage's sort order - is the two lines below.
import { useCallback, useEffect, useMemo, useState } from "react"
import { InlineError } from "@/components/ui/InlineError"
import { fullStamp } from "@/lib/dates"
import { RichTextEditor } from "@/components/ui/RichTextEditor"
import { RichTextView } from "@/components/ui/RichTextView"
import { bodyToPlainText, plainToHtml, isEmptyRich } from "@/lib/message-format"
import ArchivedChip from "@/components/admin/ArchivedChip"
import type { CaseStatusBoardRow, CaseFlag } from "@/lib/case-status"

const NAVY = "#1b2d45"

export interface StageOption {
  value: string
  label: string
}

type SortKey = "name" | "stage" | "stale"

const SORTS: { key: SortKey; label: string }[] = [
  { key: "name", label: "Client name" },
  { key: "stage", label: "Stage order" },
  { key: "stale", label: "Longest without an update" },
]

// Mirror of stageOrder() in lib/case-status.ts. Kept local so this file never
// imports that server module; if the rule changes, change it in both places.
function orderOf(raw: string): number {
  const match = /^\s*(\d+)/.exec(raw)
  return match ? Number(match[1]) : 99
}

function rowOrder(row: CaseStatusBoardRow): number {
  if (row.stages.length === 0) return 100
  return Math.min(...row.stages.map(orderOf))
}

function ago(days: number | null): string {
  if (days === null) return "never updated"
  if (days === 0) return "updated today"
  if (days === 1) return "updated yesterday"
  return `updated ${days} days ago`
}

export default function StatusBoard({
  initialRows,
  stageOptions,
  initialFlags,
  loadError = false,
}: {
  initialRows: CaseStatusBoardRow[]
  stageOptions: StageOption[]
  initialFlags: CaseFlag[]
  loadError?: boolean
}) {
  const [rows, setRows] = useState<CaseStatusBoardRow[]>(initialRows)
  const [flags, setFlags] = useState<CaseFlag[]>(initialFlags)
  const [query, setQuery] = useState("")
  const [sortKey, setSortKey] = useState<SortKey>("name")
  const [onlyStuck, setOnlyStuck] = useState(false)

  // Inline edit - one row at a time, so there is never an ambiguous "save".
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editStages, setEditStages] = useState<string[]>([])
  const [editText, setEditText] = useState("")
  const [editInternal, setEditInternal] = useState("")
  // Per-row "yes, I really mean to clear this" latch.
  const [clearConfirm, setClearConfirm] = useState<Record<string, boolean>>({})
  const [savingId, setSavingId] = useState<string | null>(null)
  const [draftingId, setDraftingId] = useState<string | null>(null)
  // Errors and confirmations are keyed by case, so a failure on one row can
  // never show up under another.
  const [rowError, setRowError] = useState<Record<string, string>>({})
  const [rowNote, setRowNote] = useState<Record<string, string>>({})

  function noteFor(id: string, message: string) {
    setRowNote((prev) => ({ ...prev, [id]: message }))
  }
  function errorFor(id: string, message: string) {
    setRowError((prev) => ({ ...prev, [id]: message }))
  }
  function clearRow(id: string) {
    setRowError((prev) => ({ ...prev, [id]: "" }))
    setRowNote((prev) => ({ ...prev, [id]: "" }))
  }

  // "Ask about these cases"
  const [question, setQuestion] = useState("")
  const [asking, setAsking] = useState(false)
  const [answer, setAnswer] = useState("")
  const [askError, setAskError] = useState("")

  const plainOf = useMemo(() => {
    const map = new Map<string, string>()
    for (const opt of stageOptions) map.set(opt.value, opt.label)
    return (raw: string): string => map.get(raw) ?? raw
  }, [stageOptions])

  const flagReason = useMemo(() => {
    const map = new Map<string, string>()
    for (const f of flags) map.set(f.recordId, f.reason)
    return map
  }, [flags])

  const refreshFlags = useCallback(async () => {
    const res = await fetch("/api/admin/case-status/assist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "flag" }),
    }).catch(() => null)
    if (!res?.ok) return // the markers just stay as they were
    const data = (await res.json().catch(() => null)) as { flags?: CaseFlag[] } | null
    if (data?.flags) setFlags(data.flags)
  }, [])

  useEffect(() => {
    setRows(initialRows)
  }, [initialRows])

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = rows.filter((r) => {
      if (onlyStuck && !flagReason.has(r.recordId)) return false
      if (!q) return true
      return r.name.toLowerCase().includes(q)
    })
    const sorted = [...list]
    if (sortKey === "name") sorted.sort((a, b) => a.name.localeCompare(b.name))
    else if (sortKey === "stage")
      sorted.sort((a, b) => rowOrder(a) - rowOrder(b) || a.name.localeCompare(b.name))
    else
      sorted.sort((a, b) => {
        // Never-updated cases are the stalest thing on the board, so they lead.
        const av = a.daysSinceUpdate === null ? Number.MAX_SAFE_INTEGER : a.daysSinceUpdate
        const bv = b.daysSinceUpdate === null ? Number.MAX_SAFE_INTEGER : b.daysSinceUpdate
        return bv - av || a.name.localeCompare(b.name)
      })
    return sorted
  }, [rows, query, sortKey, onlyStuck, flagReason])

  function startEdit(row: CaseStatusBoardRow) {
    setEditingId(row.recordId)
    setEditStages(row.stages)
    // The editor holds HTML. A row whose formatting no longer matches Airtable
    // (edited on the board) opens with Airtable's words as plain paragraphs.
    setEditText(row.statusHtml || plainToHtml(row.statusText))
    setEditInternal(row.internalHtml || plainToHtml(row.internalText))
    clearRow(row.recordId)
  }

  function toggleStage(value: string) {
    setEditStages((prev) => (prev.includes(value) ? prev.filter((s) => s !== value) : [...prev, value]))
  }

  async function save(row: CaseStatusBoardRow) {
    // Saving an empty box would blank what the client reads, silently, on one
    // misclick. Clearing is possible, but it has to be deliberate.
    if (isEmptyRich(editText) && row.statusText) {
      if (!clearConfirm[row.recordId]) {
        setClearConfirm((p) => ({ ...p, [row.recordId]: true }))
        errorFor(
          row.recordId,
          "That would remove the update the client currently reads. Press Save again to confirm."
        )
        return
      }
      setClearConfirm((p) => ({ ...p, [row.recordId]: false }))
    }
    setSavingId(row.recordId)
    clearRow(row.recordId)
    // Only send `stages` when this row actually has a Status record behind it.
    // Belt and braces against ever PATCHing an empty stage list over real data.
    // Send the HTML; the server derives the plain text Airtable stores, so the
    // two can never drift apart.
    const body: {
      recordId: string
      statusHtml: string
      internalHtml: string
      stages?: string[]
    } = {
      recordId: row.recordId,
      statusHtml: editText,
      internalHtml: editInternal,
    }
    if (row.hasStatusRecord) body.stages = editStages

    const res = await fetch("/api/admin/case-status", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).catch(() => null)
    setSavingId(null)

    if (!res?.ok) {
      const data = (await res?.json().catch(() => null)) as { error?: string } | null
      errorFor(row.recordId, data?.error || "Couldn't save that change - nothing was written. Try again.")
      return
    }

    const savedStages = [...editStages]
    const savedHtml = editText
    const savedInternalHtml = editInternal
    // Wrapped for the same reason the server wraps it - see statusHtmlToPlain.
    // This must match what the server stored or the row would show one thing
    // and the board another until the next reload.
    const savedText = bodyToPlainText(`<p>${editText}</p>`)
    const savedInternalText = bodyToPlainText(`<p>${editInternal}</p>`)
    const now = new Date().toISOString()
    setRows((prev) =>
      prev.map((r) =>
        r.recordId === row.recordId
          ? {
              ...r,
              stages: savedStages,
              plainStages: savedStages.map(plainOf),
              statusText: savedText,
              statusHtml: savedHtml,
              internalText: savedInternalText,
              internalHtml: savedInternalHtml,
              lastModified: now,
              daysSinceUpdate: 0,
              hasStatusRecord: true,
            }
          : r
      )
    )
    setEditingId(null)
    noteFor(
      row.recordId,
      "Saved. The client-facing text is what they now read on their Status page; the internal note stays here."
    )
    void refreshFlags()
  }

  async function draft(row: CaseStatusBoardRow) {
    setDraftingId(row.recordId)
    clearRow(row.recordId)
    const res = await fetch("/api/admin/case-status/assist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode: "draft",
        name: row.name,
        stages: editingId === row.recordId ? editStages : row.stages,
        statusText: row.statusText,
        // The firm's own note is the best raw material for a client-facing
        // update, so it is sent as context. It is never returned verbatim: the
        // assist route's house rules rewrite it in plain, client-safe English.
        context: bodyToPlainText(
          `<p>${editingId === row.recordId ? editInternal : row.internalHtml || row.internalText}</p>`
        ),
        caseTypes: row.caseTypes,
        county: row.county,
        daysSinceUpdate: row.daysSinceUpdate,
      }),
    }).catch(() => null)
    setDraftingId(null)

    if (!res?.ok) {
      const data = (await res?.json().catch(() => null)) as { error?: string } | null
      errorFor(row.recordId, data?.error || "Couldn't draft an update right now - try again.")
      return
    }
    const data = (await res.json().catch(() => null)) as { text?: string } | null
    if (!data?.text) {
      errorFor(row.recordId, "The draft came back empty - try again.")
      return
    }
    // Drop it into the editor. It is a suggestion sitting in a text box: nothing
    // is saved and nothing is sent until Save is pressed.
    if (editingId !== row.recordId) startEdit(row)
    // Claude returns plain sentences; the editor holds HTML.
    setEditText(plainToHtml(data.text))
    noteFor(
      row.recordId,
      "Draft only, written from your internal note. Read it, edit it, then Save. Nothing has been saved or sent."
    )
  }

  async function ask() {
    const q = question.trim()
    if (!q) {
      setAskError("Type a question first.")
      return
    }
    setAsking(true)
    setAskError("")
    setAnswer("")
    const res = await fetch("/api/admin/case-status/assist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "ask", question: q }),
    }).catch(() => null)
    setAsking(false)

    if (!res?.ok) {
      const data = (await res?.json().catch(() => null)) as { error?: string } | null
      setAskError(data?.error || "Couldn't answer that right now - try again.")
      return
    }
    const data = (await res.json().catch(() => null)) as { text?: string } | null
    if (!data?.text) {
      setAskError("The answer came back empty - try again.")
      return
    }
    setAnswer(data.text)
  }

  const stuckCount = rows.filter((r) => flagReason.has(r.recordId)).length

  return (
    <div className="space-y-5">
      {/* Ask about these cases */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <p className="section-label mb-2">Ask about these cases</p>
        <div className="flex flex-col md:flex-row gap-2 md:items-start">
          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            rows={2}
            placeholder="Which cases have been sitting the longest without an update?"
            className="flex-1 px-3 py-2 text-sm bg-white border border-gray-300 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="button"
            onClick={ask}
            disabled={asking}
            className="shrink-0 px-4 py-2.5 rounded-xl text-white text-sm font-semibold hover:opacity-90 disabled:opacity-60"
            style={{ background: NAVY }}
          >
            {asking ? "Thinking…" : "Ask"}
          </button>
        </div>
        {askError && <InlineError message={askError} onRetry={ask} />}
        {answer && (
          <p className="mt-3 text-sm text-gray-800 whitespace-pre-wrap bg-gray-50 rounded-lg p-3 border border-gray-200">
            {answer}
          </p>
        )}
        <p className="mt-2 text-xs text-gray-400">
          Answers are drawn from this board only, and are for you - clients never see them.
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by client name…"
          aria-label="Search by client name"
          className="flex-1 min-w-[12rem] px-4 py-2.5 text-sm bg-white border border-gray-300 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
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
          onClick={() => setOnlyStuck((v) => !v)}
          className={`px-3.5 py-2 rounded-full text-xs font-semibold border ${onlyStuck ? "text-white border-transparent" : "bg-white text-gray-700 border-gray-300"}`}
          style={onlyStuck ? { background: "#9a3412" } : undefined}
        >
          {onlyStuck ? "Showing stuck only" : `Needs attention (${stuckCount})`}
        </button>
      </div>

      <p className="text-xs text-gray-400">
        {visible.length} of {rows.length} {rows.length === 1 ? "case" : "cases"}
      </p>

      {loadError && (
        <p className="text-sm text-red-600 bg-white rounded-xl border border-red-200 p-4">
          The case board couldn&apos;t be loaded right now - refresh to try again.
        </p>
      )}

      {!loadError && visible.length === 0 && (
        <p className="text-sm text-gray-500 bg-white rounded-xl border border-gray-200 p-6">
          {rows.length === 0 ? "No cases on the board yet." : "Nothing matches those filters."}
        </p>
      )}

      <div className="space-y-3">
        {visible.map((row) => {
          const reason = flagReason.get(row.recordId)
          const editing = editingId === row.recordId
          return (
            <div
              key={row.recordId}
              className={`rounded-xl border border-gray-200 p-4 ${row.archived ? "bg-gray-50" : "bg-white"}`}
              style={{ borderLeft: `4px solid ${row.archived ? "#cbd5e1" : reason ? "#c2410c" : NAVY}` }}
            >
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <p className="text-sm font-semibold text-gray-900 min-w-0 truncate">
                  {row.name}
                  {row.archived && <ArchivedChip note={row.archiveNote} className="ml-2" />}
                  {!row.hasStatusRecord && (
                    <span className="ml-2 text-xs font-normal text-gray-400">no status record</span>
                  )}
                </p>
                {/* "updated today" is quick to scan; the exact stamp beside it
                    is what makes the board a record rather than a snapshot. */}
                <span className="shrink-0 text-xs text-gray-400">
                  {ago(row.daysSinceUpdate)}
                  {row.lastModified && (
                    <span className="text-gray-300"> · {fullStamp(row.lastModified)}</span>
                  )}
                </span>
              </div>

              {reason && (
                <p className="mt-1.5">
                  <span
                    className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-semibold"
                    style={{ background: "#fdebd8", color: "#7c2d12" }}
                    title="Flagged automatically - no one has been notified"
                  >
                    ⚠ {reason}
                  </span>
                </p>
              )}

              {/* Current stage pills - plain English, raw value on hover */}
              <div className="mt-2 flex flex-wrap gap-1.5">
                {row.stages.length > 0 ? (
                  row.stages.map((s) => (
                    <span
                      key={s}
                      title={s}
                      className="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold"
                      style={{ background: "#eef2f7", color: NAVY }}
                    >
                      {plainOf(s)}
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-gray-400">No stage set</span>
                )}
              </div>

              {!editing && (
                <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                  {/* Internal note. Grey, and labelled as private on every row,
                      so it can never be mistaken for the client-facing text. */}
                  <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-1">
                      Internal note · not shown to the client
                    </p>
                    {row.internalHtml ? (
                      <RichTextView html={row.internalHtml} className="text-gray-700" />
                    ) : (
                      <p
                        className={`text-sm whitespace-pre-wrap ${row.internalText ? "text-gray-700" : "text-gray-400"}`}
                      >
                        {row.internalText || "Nothing written."}
                      </p>
                    )}
                  </div>

                  {/* Client-facing. Navy edge, the same colour the client sees
                      their own status card in. */}
                  <div
                    className="rounded-lg border border-gray-200 bg-white p-3 border-l-4"
                    style={{ borderLeftColor: NAVY }}
                  >
                    <p className="text-[11px] font-semibold uppercase tracking-wide mb-1" style={{ color: NAVY }}>
                      What the client reads
                    </p>
                    {row.statusHtml ? (
                      <RichTextView html={row.statusHtml} className="text-gray-800" />
                    ) : (
                      <p
                        className={`text-sm whitespace-pre-wrap ${row.statusText ? "text-gray-800" : "text-gray-400"}`}
                      >
                        {row.statusText || "Nothing yet - this client's Status page shows no update."}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {editing && (
                <div className="mt-3 space-y-3">
                  <div>
                    <p className="section-label mb-1.5">Stage</p>
                    <div className="max-h-44 overflow-y-auto rounded-xl border border-gray-200 p-2 grid grid-cols-1 md:grid-cols-2 gap-x-4">
                      {stageOptions.map((opt) => (
                        <label
                          key={opt.value}
                          title={opt.value}
                          className="flex items-start gap-2 py-1 text-[13px] text-gray-700 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={editStages.includes(opt.value)}
                            onChange={() => toggleStage(opt.value)}
                            className="mt-0.5 shrink-0"
                          />
                          <span>{opt.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                      <p className="section-label mb-1.5 text-gray-600">Internal note (private)</p>
                      <RichTextEditor value={editInternal} onChange={setEditInternal} />
                      <p className="mt-1 text-[11px] text-gray-400">
                        Your working note. Saves to <strong>Case Status - Dashboard</strong> on the
                        board. No client can see this, and changing it alone writes nothing to their
                        history.
                      </p>
                    </div>

                    <div
                      className="rounded-lg border border-gray-200 bg-white p-3 border-l-4"
                      style={{ borderLeftColor: NAVY }}
                    >
                      <p className="section-label mb-1.5" style={{ color: NAVY }}>
                        What the client reads
                      </p>
                      {/* Bold, colour and highlighting are kept portal-side;
                          Airtable receives the plain text of whatever is typed
                          here, so the board stays readable. */}
                      <RichTextEditor value={editText} onChange={setEditText} />
                      <p className="mt-1 text-[11px] text-gray-400">
                        Goes to <strong>Case Status - For Client</strong> and onto their Status page.
                        Formatting shows there; Airtable gets the plain text.
                      </p>
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
                      onClick={() => {
                        setEditingId(null)
                        clearRow(row.recordId)
                      }}
                      className="px-4 py-2 rounded-lg text-sm font-semibold bg-white border border-gray-300 text-gray-700"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              <div className="mt-2.5 flex flex-wrap items-center gap-3">
                {!editing && (
                  <button
                    type="button"
                    onClick={() => startEdit(row)}
                    className="text-xs text-gray-500 hover:text-gray-900 underline"
                  >
                    Edit stage &amp; both statuses
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => draft(row)}
                  disabled={draftingId === row.recordId}
                  className="text-xs text-gray-500 hover:text-gray-900 underline disabled:opacity-60"
                  title="Puts a suggested update in the text box. Nothing is saved or sent."
                >
                  {draftingId === row.recordId ? "Drafting…" : "Draft with Claude"}
                </button>
              </div>

              {rowError[row.recordId] && (
                <InlineError
                  message={rowError[row.recordId]}
                  onRetry={editing ? () => void save(row) : undefined}
                />
              )}
              {rowNote[row.recordId] && !rowError[row.recordId] && (
                <p className="text-xs text-gray-500 mt-1">{rowNote[row.recordId]}</p>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
