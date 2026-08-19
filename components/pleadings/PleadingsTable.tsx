"use client"
// components/pleadings/PleadingsTable.tsx - sortable table of the client's
// pleadings, all columns from the Airtable board but portal-styled.
// Click a column header to sort; click again to flip direction.
// Below `md` the same rows render as stacked cards so nothing scrolls sideways
// on a phone and "View file" is always a full-width tap target.

import { useMemo, useState } from "react"
import type { PleadingDoc } from "@/lib/pleadings"
import { filedByColor, folderColor } from "@/lib/airtable-colors"

function shortDate(d: string): string {
  return new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

// soften a chip color into a row wash so the text stays easy to read
function tint(hex: string, alpha = 0.5): string {
  const n = parseInt(hex.replace("#", ""), 16)
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`
}

type SortKey = "filedOn" | "title" | "filedBy" | "notes"

const COLUMNS: { key: SortKey; label: string }[] = [
  { key: "filedOn", label: "Date" },
  { key: "title", label: "Document" },
  { key: "filedBy", label: "Filed By" },
  { key: "notes", label: "Notes" },
]

// label column of the phone cards, styled like the table's column headers
const CARD_LABEL = "w-20 shrink-0 pt-0.5 text-[10px] uppercase tracking-wide text-gray-500 font-semibold"

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
    <>
      {/* Phones: one card per filing, in the same order the table is sorted in. */}
      <ul className="md:hidden space-y-3">
        {sorted.map((d) => {
          const dateLabel = d.filedOn ? shortDate(d.filedOn) : "-"
          const fc = d.folder ? folderColor(d.folder) : null
          return (
            <li
              key={d.id}
              className="rounded-xl border border-gray-200 bg-white p-4"
              style={
                fc
                  ? {
                      background: tint(fc.bg),
                      WebkitPrintColorAdjust: "exact",
                      printColorAdjust: "exact",
                    }
                  : undefined
              }
            >
              <p className="text-[15px] font-semibold text-gray-900 break-words">{d.title}</p>
              {d.folder && fc && (
                <span
                  className="mt-2 inline-block text-[11px] font-semibold px-2 py-0.5 rounded-full border border-black/5"
                  style={{
                    background: fc.bg,
                    color: fc.text,
                    WebkitPrintColorAdjust: "exact",
                    printColorAdjust: "exact",
                  }}
                >
                  {d.folder}
                </span>
              )}
              <dl className="mt-3 space-y-2 text-sm">
                <div className="flex gap-3">
                  <dt className={CARD_LABEL}>Date</dt>
                  <dd className="font-medium text-gray-700">{dateLabel}</dd>
                </div>
                <div className="flex gap-3">
                  <dt className={CARD_LABEL}>Filed By</dt>
                  <dd>
                    {d.filedBy ? (
                      <span
                        className="text-xs font-medium px-2 py-0.5 rounded-full border border-black/5"
                        style={{ background: filedByColor(d.filedBy).bg, color: filedByColor(d.filedBy).text }}
                      >
                        {d.filedBy.replace(/\s+/g, " ").trim()}
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
            </li>
          )
        })}
      </ul>

      <div className="hidden md:block bg-white rounded-lg border border-gray-200 overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200">
            {COLUMNS.flatMap((c, i) => [
              <th
                key={c.key}
                onClick={() => clickHeader(c.key)}
                className="text-left px-4 py-3 text-xs uppercase tracking-wide text-gray-500 font-semibold cursor-pointer select-none hover:text-gray-800 whitespace-nowrap"
              >
                {c.label}
                <span className="inline-block w-3 text-gray-400">
                  {sortKey === c.key ? (asc ? " ↑" : " ↓") : ""}
                </span>
              </th>,
              // the "View file" button sits right after Date, before Document
              ...(i === 0 ? [<th key="view-file" className="px-4 py-3" />] : []),
            ])}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {sorted.map((d) => {
            // the Date column is always the date at the start of the file name;
            // a name with no date shows nothing rather than the sync date
            const dateLabel = d.filedOn ? shortDate(d.filedOn) : "-"
            // filings kept in a subfolder ("TPO") are tagged and washed in that
            // folder's color so they stand apart from the main docket
            const fc = d.folder ? folderColor(d.folder) : null
            return (
              <tr
                key={d.id}
                className={`align-top ${fc ? "" : "hover:bg-gray-50/70"}`}
                style={
                  fc
                    ? {
                        background: tint(fc.bg),
                        WebkitPrintColorAdjust: "exact",
                        printColorAdjust: "exact",
                      }
                    : undefined
                }
              >
                <td className="px-4 py-3 whitespace-nowrap font-semibold text-gray-700">{dateLabel}</td>
                <td className="px-4 py-3 whitespace-nowrap">
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
                <td className="px-4 py-3 font-medium text-gray-900 min-w-[14rem] max-w-md break-words">
                  {d.title}
                  {d.folder && fc && (
                    <span
                      className="ml-2 align-middle text-[11px] font-semibold px-2 py-0.5 rounded-full border border-black/5 whitespace-nowrap"
                      style={{
                        background: fc.bg,
                        color: fc.text,
                        WebkitPrintColorAdjust: "exact",
                        printColorAdjust: "exact",
                      }}
                    >
                      {d.folder}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  {d.filedBy ? (
                    <span
                      className="text-xs font-medium px-2 py-0.5 rounded-full border border-black/5"
                      style={{ background: filedByColor(d.filedBy).bg, color: filedByColor(d.filedBy).text }}
                    >
                      {d.filedBy.replace(/\s+/g, " ").trim()}
                    </span>
                  ) : (
                    <span className="text-gray-300">-</span>
                  )}
                </td>
                <td className="px-4 py-3 text-gray-600 max-w-[16rem] break-words whitespace-pre-wrap">{d.notes || ""}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
      </div>
    </>
  )
}
