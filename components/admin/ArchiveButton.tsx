"use client"
// components/admin/ArchiveButton.tsx — archive / restore one client from the
// admin Clients list (2026-08-19). Same icon-over-label shape as the other
// per-client actions on that row.
//
// The confirm spells out the consequence rather than asking "are you sure":
// archiving is not a delete, but it does start a clock that ends in the client
// losing access, and that is the part worth reading before clicking.
import { useState } from "react"
import { useRouter } from "next/navigation"
import { ConfirmDialog } from "@/components/ui/ConfirmDialog"

export default function ArchiveButton({
  recordId,
  clientId,
  name,
  archived,
  graceDays,
}: {
  /** The CLIENTS-table record id — what gets PATCHed. Not the clientId. */
  recordId: string
  /** The linked Status record id the portal uses as a client id, for the stamp. */
  clientId: string
  name: string
  archived: boolean
  /**
   * ARCHIVE_GRACE_DAYS, handed down from the page rather than imported here:
   * lib/client-archive pulls in the database client, which has no business in
   * a browser bundle. Passing it keeps the two numbers from drifting apart.
   */
  graceDays: number
}) {
  const router = useRouter()
  const [confirming, setConfirming] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const who = name || "this client"

  async function run() {
    setConfirming(false)
    setSaving(true)
    setError(null)
    const res = await fetch("/api/admin/clients/archive", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recordId, clientId, archived: !archived }),
    }).catch(() => null)

    if (!res?.ok) {
      const data = (await res?.json().catch(() => null)) as { error?: string } | null
      setSaving(false)
      // Never fail silently — the row stays exactly as it was and says why.
      setError(data?.error || "Couldn't save that — nothing was changed. Try again.")
      return
    }
    // Leave the spinner up until the server-rendered list has actually caught up.
    router.refresh()
    setSaving(false)
  }

  // Airtable can't be PATCHed without a record id, so say so rather than
  // offering a button that would always fail.
  if (!recordId.startsWith("rec")) return null

  return (
    <>
      {/* The failure message sits under the button rather than in a toast, so
          the row that didn't change is the row that says so. */}
      <span className="flex flex-col items-center">
        <button
          type="button"
          onClick={() => { setError(null); setConfirming(true) }}
          disabled={saving}
          title={
            error
              ? error
              : archived
                ? `Restore ${who} to the active client list`
                : `Archive ${who} — closed case, read-only for ${graceDays} days`
          }
          className="flex flex-col items-center gap-1 px-2 py-1.5 rounded-lg hover:bg-gray-100 transition-colors w-[4.5rem] disabled:opacity-70"
        >
          <span className="text-2xl leading-none">{saving ? "⏳" : archived ? "♻️" : "🗄️"}</span>
          <span className={`text-[11px] font-medium ${error ? "text-red-600" : "text-gray-600"}`}>
            {saving ? "Saving…" : error ? "Retry" : archived ? "Restore" : "Archive"}
          </span>
        </button>
        {error && (
          <span role="status" className="mt-0.5 max-w-[10rem] text-center text-[10px] leading-tight text-red-600">
            {error}
          </span>
        )}
      </span>

      <ConfirmDialog
        open={confirming}
        title={archived ? `Restore ${who}?` : `Archive ${who}?`}
        body={
          archived
            ? `${who} goes back on the active client list and gets their full portal access back. The ${graceDays}-day countdown is cleared.`
            : `${who} keeps read-only access to their portal for ${graceDays} days — they can still read their case file, but can't send messages or upload anything. After ${graceDays} days they lose access entirely. They'll be hidden from your admin lists unless you turn on "Include archived". You can restore them at any time.`
        }
        confirmLabel={archived ? "Restore client" : "Archive client"}
        onConfirm={run}
        onCancel={() => setConfirming(false)}
      />
    </>
  )
}
