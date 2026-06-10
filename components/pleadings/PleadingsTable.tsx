"use client"
// components/pleadings/PleadingsTable.tsx — sortable table of the client's
// pleadings, all columns from the Airtable board but portal-styled.
// Click a column header to sort; click again to flip direction.

import { useMemo, useState } from "react"
import type { PleadingDoc } from "@/lib/pleadings"
import { filedByColor } from "@/lib/airtable-colors"

function shortDate(d: string): string {
  return new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

type SortKey = "filedOn" | "title" | "filedBy" | "notes"

const COLUMNS: { key: SortKey; label: string }[] = [
  { key: "filedOn", label: "Date" },
  { key: "title", label: "Document" },
  { key: "filedBy", label: "Filed By" },
  { key: "notes", label: "Notes" },
]

function sortValue(d: PleadingDoc, key: SortKey): string {
  if (key === "filedOn") return d.filedOn ?? (d.created ?? "").slice(0, 10)
  return (d[key] ?? "").toString().toLowerCase()
}

export default function PleadingsTable({ docs }: { docs: PleadingDoc[] }) {
  const [sortKey, setSortKey] = useState<SortKey>("filedOn")
  const [asc, setAsc] = useState(false) // newest first by default

  const sorted = useMemo(() => {
    const copy = docs.slice()
    copy.sort((a, b) => {
      const va = sortValue(a, sortKey)
      const vb = sortValue(b, sortKey)
      if (va === vb) return 0
      // empty values always sort to the bottom
      if (!va) return 1
      if (!vb) return -1
      return asc ? va.localeCompare(vb) : vb.localeCompare(va)
    })
    return copy
  }, [docs, sortKey, asc])

  function clickHeader(key: SortKey) {
    if (key === sortKey) {
      setAsc(!asc)
    } else {
      setSortKey(key)
      setAsc(key !== "filedOn") // text columns start A→Z, date starts newest first
    }
  }

  if (docs.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <p className="text-sm text-gray-500">No pleadings on file yet. Documents will appear here as they are filed.</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200">
            {COLUMNS.map((c) => (
              <th
                key={c.key}
                onClick={() => clickHeader(c.key)}
                className="text-left px-4 py-3 text-xs uppercase tracking-wide text-gray-500 font-semibold cursor-pointer select-none hover:text-gray-800 whitespace-nowrap"
              >
                {c.label}
                <span className="inline-block w-3 text-gray-400">
                  {sortKey === c.key ? (asc ? " ↑" : " ↓") : ""}
                </span>
              </th>
            ))}
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {sorted.map((d) => {
            const dateLabel = d.filedOn
              ? shortDate(d.filedOn)
              : d.created
                ? shortDate(d.created.slice(0, 10))
                : "—"
            return (
              <tr key={d.id} className="align-top hover:bg-gray-50/70">
                <td className="px-4 py-3 whitespace-nowrap font-semibold text-gray-700">{dateLabel}</td>
                <td className="px-4 py-3 font-medium text-gray-900 min-w-[14rem] max-w-md break-words">{d.title}</td>
                <td className="px-4 py-3 whitespace-nowrap">
                  {d.filedBy ? (
                    <span
                      className="text-xs font-medium px-2 py-0.5 rounded-full border border-black/5"
                      style={{ background: filedByColor(d.filedBy).bg, color: filedByColor(d.filedBy).text }}
                    >
                      {d.filedBy.replace(/\s+/g, " ").trim()}
                    </span>
                  ) : (
                    <span className="text-gray-300">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-gray-600 max-w-[16rem] break-words whitespace-pre-wrap">{d.notes || ""}</td>
                <td className="px-4 py-3 whitespace-nowrap text-right">
                  {d.link && (
                    <a
                      href={d.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-semibold px-3.5 py-1.5 rounded-lg text-white hover:opacity-90 transition-opacity inline-block print:hidden"
                      style={{ background: "#1b2d45" }}
                    >
                      View file
                    </a>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
