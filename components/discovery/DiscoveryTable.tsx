"use client"
// components/discovery/DiscoveryTable.tsx - sortable table of discovery items
// the firm has made available to the client. Mirrors the pleadings table.
// Below `md` the same rows render as stacked cards so nothing scrolls sideways
// on a phone and "View file" is always a full-width tap target.

import { useMemo, useState } from "react"
import DriveFolderPeek from "@/components/discovery/DriveFolderPeek"
import { isDriveFolderLink } from "@/lib/drive-folder-link"
import type { DiscoveryDoc } from "@/lib/discovery"

function shortDate(d: string): string {
  return new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

function directionStyle(direction: string): { bg: string; text: string } {
  const n = direction.toLowerCase()
  if (n.includes("incoming")) return { bg: "#D0F0FD", text: "#04283F" }
  if (n.includes("outgoing")) return { bg: "#FFEAB6", text: "#3B2501" }
  return { bg: "#EEEEEE", text: "#333333" }
}

type SortKey = "date" | "title" | "direction" | "notes"

const COLUMNS: { key: SortKey; label: string }[] = [
  { key: "date", label: "Date" },
  { key: "title", label: "Document" },
  { key: "direction", label: "Direction" },
  { key: "notes", label: "Notes" },
]

// label column of the phone cards, styled like the table's column headers
const CARD_LABEL = "w-20 shrink-0 pt-0.5 text-[10px] uppercase tracking-wide text-gray-500 font-semibold"

function sortValue(d: DiscoveryDoc, key: SortKey): string {
  if (key === "date") return d.date ?? ""
  return (d[key] ?? "").toString().toLowerCase()
}

export default function DiscoveryTable({ docs }: { docs: DiscoveryDoc[] }) {
  const [sortKey, setSortKey] = useState<SortKey>("date")
  const [asc, setAsc] = useState(false) // newest first by default

  const sorted = useMemo(() => {
    const copy = docs.slice()
    copy.sort((a, b) => {
      const va = sortValue(a, sortKey)
      const vb = sortValue(b, sortKey)
      if (va === vb) return 0
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
      setAsc(key !== "date")
    }
  }

  if (docs.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <p className="text-sm text-gray-500">No discovery documents are available yet. Items will appear here as your attorney shares them.</p>
      </div>
    )
  }

  return (
    <>
      {/* Phones: one card per item, in the same order the table is sorted in. */}
      <ul className="md:hidden space-y-3">
        {sorted.map((d) => (
          <li key={d.id} className="rounded-xl border border-gray-200 bg-white p-4">
            <p className="text-[15px] font-semibold text-gray-900 break-words">{d.title}</p>
            {d.tags.length > 0 && (
              <span className="mt-2 flex flex-wrap gap-1">
                {d.tags.map((t) => (
                  <span key={t} className="inline-block text-[10px] font-medium px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">
                    {t}
                  </span>
                ))}
              </span>
            )}
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex gap-3">
                <dt className={CARD_LABEL}>Date</dt>
                <dd className="font-medium text-gray-700">{d.date ? shortDate(d.date) : "-"}</dd>
              </div>
              <div className="flex gap-3">
                <dt className={CARD_LABEL}>Direction</dt>
                <dd>
                  {d.direction ? (
                    <span
                      className="text-xs font-medium px-2 py-0.5 rounded-full border border-black/5"
                      style={{ background: directionStyle(d.direction).bg, color: directionStyle(d.direction).text }}
                    >
                      {d.direction}
                    </span>
                  ) : (
                    <span className="text-gray-300">-</span>
                  )}
                </dd>
              </div>
              {d.notes && (
                <div className="flex gap-3">
                  <dt className={CARD_LABEL}>Notes</dt>
                  <dd className="text-gray-600 break-words whitespace-pre-wrap">{d.notes}</dd>
                </div>
              )}
            </dl>
            {d.link && (
              <a
                href={d.link}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 w-full min-h-[44px] px-4 rounded-lg text-white text-sm font-semibold flex items-center justify-center active:opacity-90 print:hidden"
                style={{ background: "#1b2d45" }}
              >
                View file
              </a>
            )}
            {/* A folder link on its own says nothing about what is inside, so
                the contents can be listed here without leaving the portal. */}
            {isDriveFolderLink(d.link) && (
              <div className="mt-2">
                <DriveFolderPeek recordId={d.id} />
              </div>
            )}
          </li>
        ))}
      </ul>

      <div className="hidden md:block bg-white rounded-lg border border-gray-200 overflow-x-auto">
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
          {sorted.map((d) => (
            <tr key={d.id} className="align-top hover:bg-gray-50/70">
              <td className="px-4 py-3 whitespace-nowrap font-semibold text-gray-700">
                {d.date ? shortDate(d.date) : "-"}
              </td>
              <td className="px-4 py-3 font-medium text-gray-900 min-w-[14rem] max-w-md break-words">
                {d.title}
                {d.tags.length > 0 && (
                  <span className="block mt-1 space-x-1">
                    {d.tags.map((t) => (
                      <span key={t} className="inline-block text-[10px] font-medium px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">
                        {t}
                      </span>
                    ))}
                  </span>
                )}
              </td>
              <td className="px-4 py-3 whitespace-nowrap">
                {d.direction ? (
                  <span
                    className="text-xs font-medium px-2 py-0.5 rounded-full border border-black/5"
                    style={{ background: directionStyle(d.direction).bg, color: directionStyle(d.direction).text }}
                  >
                    {d.direction}
                  </span>
                ) : (
                  <span className="text-gray-300">-</span>
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
                {isDriveFolderLink(d.link) && (
                  <div className="mt-2 text-right">
                    <DriveFolderPeek recordId={d.id} label="What's inside" />
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </>
  )
}
