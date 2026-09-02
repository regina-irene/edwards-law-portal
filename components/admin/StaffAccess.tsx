"use client"
// components/admin/StaffAccess.tsx - who at the firm can sign in to the admin
// side (2026-08-22).
//
// This list IS the admin allowlist. Somebody on it can sign in and see every
// client, every message and every field note; somebody not on it cannot get in
// at all, whatever access they have to Google Cloud, Workspace or Drive.
//
// Worth being blunt about that in the UI, because the natural assumption is the
// opposite: adding a colleague in the Google Cloud console feels like granting
// them access and does nothing here.
import { useCallback, useEffect, useState } from "react"
import { InlineError } from "@/components/ui/InlineError"
import { ConfirmDialog } from "@/components/ui/ConfirmDialog"

interface Staff {
  email: string
  name: string
}

export default function StaffAccess() {
  const [staff, setStaff] = useState<Staff[]>([])
  const [you, setYou] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [note, setNote] = useState("")

  const [email, setEmail] = useState("")
  const [name, setName] = useState("")
  const [saving, setSaving] = useState(false)
  const [confirming, setConfirming] = useState<Staff | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch("/api/admin/staff").catch(() => null)
    setLoading(false)
    if (!res?.ok) {
      setError("Couldn't read the staff list.")
      return
    }
    const data = (await res.json().catch(() => null)) as { staff?: Staff[]; you?: string } | null
    setStaff(data?.staff ?? [])
    setYou(data?.you ?? "")
    setError("")
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function add() {
    setSaving(true)
    setError("")
    setNote("")
    const res = await fetch("/api/admin/staff", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, name }),
    }).catch(() => null)
    setSaving(false)
    if (!res?.ok) {
      const data = (await res?.json().catch(() => null)) as { error?: string } | null
      setError(data?.error || "Couldn't add them just now.")
      return
    }
    setNote(`${email.trim().toLowerCase()} can now sign in.`)
    setEmail("")
    setName("")
    await load()
  }

  async function remove(person: Staff) {
    setConfirming(null)
    setError("")
    setNote("")
    const res = await fetch(`/api/admin/staff?email=${encodeURIComponent(person.email)}`, {
      method: "DELETE",
    }).catch(() => null)
    if (!res?.ok) {
      const data = (await res?.json().catch(() => null)) as { error?: string } | null
      setError(data?.error || "Couldn't remove them just now.")
      return
    }
    setNote(`${person.email} can no longer sign in.`)
    await load()
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-gray-800">Staff access</h2>
        <p className="text-xs text-gray-500 mt-0.5">
          Everyone here can sign in to the admin side and see every client, message and field note.
          This list is the only thing that grants that. Adding someone in the Google Cloud console
          or to your Google Workspace does <strong>not</strong> give them access to the portal.
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-gray-400">Reading the staff list…</p>
      ) : (
        <ul className="divide-y divide-gray-100 border border-gray-200 rounded-lg">
          {staff.map((p) => (
            <li key={p.email} className="flex items-center justify-between gap-3 px-3 py-2">
              <span className="min-w-0">
                <span className="text-sm text-gray-800">{p.name || p.email}</span>
                {p.name && <span className="text-xs text-gray-400 ml-2 truncate">{p.email}</span>}
                {p.email.toLowerCase() === you && (
                  <span className="ml-2 text-[10px] uppercase tracking-wide text-gray-400">you</span>
                )}
              </span>
              {p.email.toLowerCase() !== you && (
                <button
                  type="button"
                  onClick={() => setConfirming(p)}
                  className="shrink-0 text-xs text-gray-400 hover:text-red-600 underline"
                >
                  Remove
                </button>
              )}
            </li>
          ))}
          {staff.length === 0 && (
            <li className="px-3 py-3 text-sm text-gray-400">Nobody on the list yet.</li>
          )}
        </ul>
      )}

      <div className="flex flex-wrap items-end gap-2">
        <div className="flex-1 min-w-[14rem]">
          <label htmlFor="staff-email" className="block text-xs font-semibold text-gray-500 mb-1">
            Work email
          </label>
          <input
            id="staff-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@edwardsfamilylaw.com"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="flex-1 min-w-[10rem]">
          <label htmlFor="staff-name" className="block text-xs font-semibold text-gray-500 mb-1">
            Name (optional)
          </label>
          <input
            id="staff-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <button
          type="button"
          onClick={add}
          disabled={saving || !email.trim()}
          className="px-4 py-2 rounded-lg text-white text-sm font-semibold hover:opacity-90 disabled:opacity-60"
          style={{ background: "#1b2d45" }}
        >
          {saving ? "Adding…" : "Add"}
        </button>
      </div>

      <p className="text-[11px] text-gray-400">
        They sign in at the portal with this exact address. Capitalisation doesn&apos;t matter.
      </p>

      {note && !error && <p className="text-sm text-green-700">{note}</p>}
      {error && <InlineError message={error} onRetry={() => void load()} />}

      <ConfirmDialog
        open={confirming !== null}
        title="Remove their access?"
        body={`${confirming?.name || confirming?.email} will no longer be able to sign in to the admin side. Nothing they wrote is deleted.`}
        confirmLabel="Remove access"
        onConfirm={() => confirming && void remove(confirming)}
        onCancel={() => setConfirming(null)}
      />
    </div>
  )
}
