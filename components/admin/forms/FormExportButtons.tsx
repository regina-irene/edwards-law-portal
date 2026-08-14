"use client"
// Export a completed form. CSV opens in Excel; Word opens in Word — both are
// generated from the same server response so what you export matches what's on
// screen.
import { useState } from "react"

export default function FormExportButtons({ formKey, clientId }: { formKey: string; clientId: string }) {
  const [busy, setBusy] = useState<"csv" | "doc" | null>(null)
  const [error, setError] = useState(false)

  async function download(format: "csv" | "doc") {
    setBusy(format)
    setError(false)
    const res = await fetch(
      `/api/admin/forms/export?key=${encodeURIComponent(formKey)}&clientId=${encodeURIComponent(clientId)}&format=${format}`
    ).catch(() => null)
    setBusy(null)
    if (!res?.ok) { setError(true); return }
    const blob = await res.blob()
    const name = res.headers.get("X-Filename") || `completed-form.${format === "csv" ? "csv" : "doc"}`
    const a = document.createElement("a")
    a.href = URL.createObjectURL(blob)
    a.download = name
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <span className="flex items-center gap-3">
      <button type="button" onClick={() => download("csv")} disabled={busy !== null} className="text-sm text-blue-600 hover:underline disabled:opacity-60">
        {busy === "csv" ? "Preparing…" : "Export CSV"}
      </button>
      <button type="button" onClick={() => download("doc")} disabled={busy !== null} className="text-sm text-blue-600 hover:underline disabled:opacity-60">
        {busy === "doc" ? "Preparing…" : "Export Word"}
      </button>
      {error && <span className="text-xs text-red-600">Export failed</span>}
    </span>
  )
}
