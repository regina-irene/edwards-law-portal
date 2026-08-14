"use client"
// components/notes/NotesClientList.tsx — the Field Notes hub's A→Z case list
// with a type-ahead filter, so a hub with dozens of cases still gets you to
// one in a couple of keystrokes.
import Link from "next/link"
import { useState } from "react"

export interface NotesClientRow {
  id: string
  label: string
  snippet: string
  date: string
  author: string | null
}

export default function NotesClientList({ rows, notesFailed = false }: { rows: NotesClientRow[]; notesFailed?: boolean }) {
  const [query, setQuery] = useState("")

  const q = query.trim().toLowerCase()
  const visible = q ? rows.filter((r) => r.label.toLowerCase().includes(q)) : rows

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <input
          list="field-notes-cases"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="All cases — type to filter"
          className="w-full max-w-sm px-3 py-2 text-sm bg-white border border-gray-300 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <datalist id="field-notes-cases">
          {rows.map((r) => <option key={r.id} value={r.label} />)}
        </datalist>
        {query && (
          <button type="button" onClick={() => setQuery("")} className="text-sm text-gray-400 hover:text-gray-700 underline">
            Clear
          </button>
        )}
        <span className="ml-auto text-xs text-gray-400">
          {visible.length} of {rows.length} {rows.length === 1 ? "case" : "cases"}
        </span>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
        {visible.map((r) => (
          <Link key={r.id} href={`/admin/notes/${encodeURIComponent(r.id)}`} className="flex items-baseline justify-between gap-4 px-5 py-3.5 hover:bg-gray-50">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-900">{r.label}</p>
              <p className="text-sm text-gray-500 truncate">{notesFailed ? "" : r.snippet || "No notes yet"}</p>
            </div>
            {r.date && (
              <span className="shrink-0 text-xs text-gray-400">
                {r.date}{r.author && ` · ${r.author}`}
              </span>
            )}
          </Link>
        ))}
        {rows.length === 0 && <p className="px-5 py-6 text-sm text-gray-500">No clients found (Airtable may be unreachable) — try again shortly.</p>}
        {rows.length > 0 && visible.length === 0 && <p className="px-5 py-6 text-sm text-gray-500">No case matches “{query.trim()}”.</p>}
      </div>
    </div>
  )
}
