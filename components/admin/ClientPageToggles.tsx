"use client"

import { useState, useEffect } from "react"

export default function ClientPageToggles({ clientId }: { clientId: string }) {
  const [pages, setPages] = useState<{ key: string; label: string }[]>([])
  const [hidden, setHidden] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/admin/client-pages?clientId=${encodeURIComponent(clientId)}`)
      .then((r) => r.json())
      .then((d) => { setPages(d.pages ?? []); setHidden(new Set(d.hidden ?? [])) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [clientId])

  async function toggle(key: string, visible: boolean) {
    setHidden((prev) => {
      const n = new Set(prev)
      if (visible) n.delete(key)
      else n.add(key)
      return n
    })
    await fetch("/api/admin/client-pages", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId, pageKey: key, hidden: !visible }),
    })
  }

  if (loading) return <p className="text-gray-400 text-sm">Loading…</p>

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-2">
      <h2 className="text-sm font-semibold text-gray-700">Visible pages</h2>
      <p className="text-xs text-gray-500">Turn pages on or off for this client. Off = hidden from their portal.</p>
      <div className="divide-y divide-gray-100">
        {pages.map((p) => {
          const visible = !hidden.has(p.key)
          return (
            <label key={p.key} className="flex items-center justify-between py-2 cursor-pointer">
              <span className={`text-sm ${visible ? "text-gray-800" : "text-gray-400"}`}>{p.label}</span>
              <input type="checkbox" checked={visible} onChange={(e) => toggle(p.key, e.target.checked)} className="w-4 h-4 accent-blue-600" />
            </label>
          )
        })}
      </div>
    </div>
  )
}
