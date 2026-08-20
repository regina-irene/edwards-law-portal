"use client"
// components/notes/LogNoteRow.tsx - one field note on the Field Notes hub's
// running log, with a Delete on it (2026-08-20).
//
// Deleting a note used to be possible only from inside a case, at
// /admin/notes/[clientId]. The hub is where the notes are actually read, so
// tidying one up meant leaving the log, finding the note again on the case
// page, deleting it there, and coming back. This puts the action where the
// note is.
//
// The hub is a server component: its rows are rendered on the server and the
// note itself arrives as `children`. So this wraps a row rather than drawing
// one, which keeps the markup in one place and means the two screens cannot
// drift apart visually.
//
// ONE CONFIRM, THEN IT IS GONE. Deliberately not the ten-second undo the
// per-case timeline used: there the DELETE was held back until the undo window
// closed, so navigating away in those ten seconds silently cancelled it and the
// note you thought you had deleted was still on the file. On a case log that is
// the wrong way round. A dialog naming what is going is the safeguard, and once
// it is confirmed the note is actually gone.
import { useState } from "react"
import { useRouter } from "next/navigation"
import { ConfirmDialog } from "@/components/ui/ConfirmDialog"

export default function LogNoteRow({
  noteId,
  caseLabel,
  children,
}: {
  noteId: string
  /** Named in the confirm dialog, so it is clear which case is being edited. */
  caseLabel: string
  children: React.ReactNode
}) {
  const router = useRouter()
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [gone, setGone] = useState(false)
  const [error, setError] = useState("")

  async function remove() {
    setConfirming(false)
    setDeleting(true)
    setError("")
    const res = await fetch(`/api/admin/notes?id=${encodeURIComponent(noteId)}`, {
      method: "DELETE",
    }).catch(() => null)
    setDeleting(false)
    if (!res?.ok) {
      setError("Couldn't delete that note - it's still on the file. Try again.")
      return
    }
    // Hide it straight away so the log doesn't sit there still showing it, then
    // re-read from the server so the counts and day headings come back right.
    setGone(true)
    router.refresh()
  }

  // Kept mounted after a delete purely to carry the confirmation line, until
  // the refresh lands and the server stops sending this row at all.
  if (gone) {
    return (
      <p className="px-5 py-3 text-xs text-gray-400 print:hidden">Note deleted.</p>
    )
  }

  return (
    <div className="relative group" style={{ borderLeft: "3px solid #1b2d45" }}>
      {children}
      <div className="absolute top-3 right-5 print:hidden">
        <button
          type="button"
          onClick={() => setConfirming(true)}
          disabled={deleting}
          aria-label={`Delete this note on ${caseLabel}`}
          // Only on hover or keyboard focus: the log is for reading, and a
          // delete on every row at all times is an easy misclick.
          className="opacity-0 group-hover:opacity-100 focus:opacity-100 text-xs text-gray-400 hover:text-red-600 underline disabled:opacity-60"
        >
          {deleting ? "Deleting…" : "Delete"}
        </button>
      </div>

      {error && <p className="px-5 pb-3 text-xs text-red-600">{error}</p>}

      <ConfirmDialog
        open={confirming}
        title="Delete this note?"
        body={`This field note on ${caseLabel} is only kept here. Deleting it removes it from the case log for good.`}
        confirmLabel="Delete note"
        onConfirm={remove}
        onCancel={() => setConfirming(false)}
      />
    </div>
  )
}
