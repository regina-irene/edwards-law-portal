"use client"
// components/notes/CaseJump.tsx - type a case name and go straight to its
// notes. Replaces the old A→Z list of every case, which was mostly rows
// reading "No notes yet".
import { useRouter } from "next/navigation"
import { useState } from "react"

export interface CaseOption {
  id: string
  label: string
  hasNotes: boolean
  /** Former / closed case. Only ever present when "Include archived" is on. */
  archived?: boolean
}

export default function CaseJump({ cases }: { cases: CaseOption[] }) {
  const router = useRouter()
  const [query, setQuery] = useState("")

  const q = query.trim().toLowerCase()
  const matches = q ? cases.filter((c) => c.label.toLowerCase().includes(q)).slice(0, 8) : []
  const exact = cases.find((c) => c.label.toLowerCase() === q)

  function go(id: string) {
    router.push(`/admin/notes/${encodeURIComponent(id)}`)
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <label htmlFor="case-jump" className="section-label">Open a case</label>
      <input
        id="case-jump"
        list="field-notes-cases"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
          // Picking from the browser's suggestion list should just go there.
          const hit = cases.find((c) => c.label === e.target.value)
          if (hit) go(hit.id)
        }}
        onKeyDown={(e) => {
          if (e.key !== "Enter") return
          const target = exact ?? matches[0]
          if (target) go(target.id)
        }}
        placeholder="Type a case name…"
        className="mt-1.5 w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      <datalist id="field-notes-cases">
        {cases.map((c) => <option key={c.id} value={c.label} />)}
      </datalist>

      {matches.length > 0 && (
        <ul className="mt-2 divide-y divide-gray-100">
          {matches.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => go(c.id)}
                className="w-full text-left px-2 py-1.5 -mx-2 rounded-lg text-sm text-gray-800 hover:bg-gray-50"
              >
                <span className={c.archived ? "text-gray-500" : undefined}>{c.label}</span>
                {c.archived && <span className="text-xs text-gray-400"> · archived</span>}
                {!c.hasNotes && <span className="text-xs text-gray-400"> · no notes yet</span>}
              </button>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-2 text-xs text-gray-400">
        {cases.length} cases · {cases.filter((c) => c.hasNotes).length} with notes
      </p>
    </div>
  )
}
