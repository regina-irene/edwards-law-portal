"use client"
// components/notes/LogEventRow.tsx - one activity entry on the Field Notes
// running log, with a Hide on it (2026-08-20).
//
// Wraps a server-rendered row, so the markup for the entry itself stays in the
// page and the two cannot drift apart. Same shape as LogNoteRow.
//
// The word is "Hide", not "Delete", and that is deliberate. These entries are
// drawn live from the conversation, the uploads, the tasks and the forms; there
// is no row here to delete. Hiding takes the line off the log and leaves the
// message, document, task or response untouched. Calling it Delete would
// promise something it does not do, on a case file, which is the worst place
// for a word to be loosely used.
import { useState } from "react"
import { useRouter } from "next/navigation"

export default function LogEventRow({
  eventId,
  hidden = false,
  children,
}: {
  eventId: string
  /** True when this row is only on screen because "Show hidden" is on. */
  hidden?: boolean
  children: React.ReactNode
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  async function toggle() {
    setBusy(true)
    setError("")
    const res = hidden
      ? await fetch(`/api/admin/timeline-hide?id=${encodeURIComponent(eventId)}`, {
          method: "DELETE",
        }).catch(() => null)
      : await fetch("/api/admin/timeline-hide", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ eventId }),
        }).catch(() => null)
    setBusy(false)
    if (!res?.ok) {
      setError(hidden ? "Couldn't restore that entry." : "Couldn't hide that entry.")
      return
    }
    // Re-read from the server rather than hiding it here, so the entry counts
    // and the "Show hidden" tally stay honest.
    router.refresh()
  }

  return (
    <div className={`relative group ${hidden ? "opacity-60" : ""}`}>
      {children}
      <div className="absolute top-2.5 right-5 print:hidden">
        <button
          type="button"
          onClick={toggle}
          disabled={busy}
          className="opacity-0 group-hover:opacity-100 focus:opacity-100 text-xs text-gray-400 hover:text-gray-800 underline disabled:opacity-60"
        >
          {busy ? "…" : hidden ? "Restore" : "Hide"}
        </button>
      </div>
      {error && <p className="px-5 pb-2 text-xs text-red-600">{error}</p>}
    </div>
  )
}
