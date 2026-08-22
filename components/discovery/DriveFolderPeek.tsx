"use client"
// components/discovery/DriveFolderPeek.tsx - "what's in this folder", inline
// under a Discovery link (2026-08-20).
//
// A Drive folder link tells you nothing until you open it, sign in, and look.
// This expands in place to the subfolders, how many files each holds, the kinds
// of file and the span of dates - so a client can tell whether the folder is
// worth opening, and the firm can see at a glance whether a link points where
// it should.
//
// Loaded on demand. A folder costs several Drive calls and most rows are never
// opened, so expanding every one on page load would be slow for no one's
// benefit.
//
// It sends the RECORD id, never a folder id: the server looks the link up
// itself and applies the same "Avail. to Client" gate the page does. See
// app/api/drive-folder.
import { useState } from "react"

interface Subfolder {
  id: string
  name: string
  fileCount: number
}

interface Summary {
  name: string
  fileCount: number
  subfolders: Subfolder[]
  types: string[]
  from: string | null
  to: string | null
  truncated: boolean
}

function shortDate(d: string): string {
  const [y, m] = d.split("-")
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
  })
}

function span(from: string | null, to: string | null): string {
  if (!from || !to) return ""
  const a = shortDate(from)
  const b = shortDate(to)
  return a === b ? a : `${a} to ${b}`
}

export default function DriveFolderPeek({
  recordId,
  baseId,
  label = "See what's in this folder",
}: {
  recordId: string
  /** Admin only. Client requests take the base from the session instead. */
  baseId?: string
  label?: string
}) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [summary, setSummary] = useState<Summary | null>(null)
  const [message, setMessage] = useState("")

  async function toggle() {
    if (open) {
      setOpen(false)
      return
    }
    setOpen(true)
    // Read once and keep it: the server caches for an hour anyway, and
    // re-fetching on every open would make the control feel slow.
    if (summary || message) return
    setLoading(true)
    const res = await fetch("/api/drive-folder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(baseId ? { recordId, baseId } : { recordId }),
    }).catch(() => null)
    setLoading(false)

    if (!res?.ok) {
      const data = (await res?.json().catch(() => null)) as { error?: string } | null
      setMessage(data?.error || "Couldn't read that folder just now.")
      return
    }
    const data = (await res.json().catch(() => null)) as
      | { ok?: boolean; summary?: Summary; error?: string }
      | null
    if (data?.ok && data.summary) setSummary(data.summary)
    else setMessage(data?.error || "Couldn't read that folder just now.")
  }

  return (
    <div className="print:hidden">
      <button
        type="button"
        onClick={toggle}
        className="text-xs text-gray-500 hover:text-gray-900 underline"
        aria-expanded={open}
      >
        {open ? "Hide contents" : label}
      </button>

      {open && (
        <div className="mt-2 rounded-lg border border-gray-200 bg-gray-50 p-3 text-[13px]">
          {loading && <p className="text-gray-500">Looking inside…</p>}

          {!loading && message && <p className="text-gray-500">{message}</p>}

          {!loading && summary && (
            <div className="space-y-2">
              <p className="text-gray-700">
                <span className="font-semibold">{summary.name}</span>
                {summary.fileCount > 0 && (
                  <>
                    {" "}
                    · {summary.fileCount} {summary.fileCount === 1 ? "file" : "files"}
                  </>
                )}
                {summary.types.length > 0 && <> · {summary.types.slice(0, 4).join(", ")}</>}
                {span(summary.from, summary.to) && <> · {span(summary.from, summary.to)}</>}
              </p>

              {summary.subfolders.length > 0 && (
                <ul className="space-y-0.5">
                  {summary.subfolders.map((sf) => (
                    <li key={sf.id} className="text-gray-700">
                      <span className="text-gray-400 mr-1.5">📁</span>
                      {sf.name}
                      <span className="text-gray-400">
                        {" "}
                        ({sf.fileCount} {sf.fileCount === 1 ? "file" : "files"})
                      </span>
                    </li>
                  ))}
                </ul>
              )}

              {summary.subfolders.length === 0 && summary.fileCount === 0 && (
                <p className="text-gray-500">This folder is empty.</p>
              )}

              {summary.truncated && (
                <p className="text-[11px] text-gray-400">
                  Only the first few hundred files were counted.
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
