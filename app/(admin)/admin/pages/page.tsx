// app/(admin)/admin/pages/page.tsx
"use client"

import { useState, useEffect } from "react"
import { PORTAL_PAGES } from "@/lib/pages"

interface PageContent {
  header: string
  announcement: string
}

type ContentMap = Record<string, PageContent>

export default function GlobalPagesEditor() {
  const CLIENT_ID = "_global"
  const [content, setContent] = useState<ContentMap>({})
  const [saving, setSaving] = useState<string | null>(null)
  const [saved, setSaved] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/admin/page-content?clientId=${encodeURIComponent(CLIENT_ID)}`)
      .then((r) => r.json())
      .then((d) => { setContent(d.content ?? {}); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  function get(page: string): PageContent {
    return content[page] ?? { header: "", announcement: "" }
  }

  function update(page: string, field: "header" | "announcement", value: string) {
    setContent((prev) => ({ ...prev, [page]: { ...get(page), [field]: value } }))
  }

  async function save(page: string) {
    setSaving(page)
    const { header, announcement } = get(page)
    const res = await fetch("/api/admin/page-content", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId: CLIENT_ID, page, header, announcement }),
    })
    setSaving(null)
    if (res.ok) { setSaved(page); setTimeout(() => setSaved(null), 2000) }
  }

  if (loading) return <p className="text-gray-400 text-sm">Loading...</p>

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Global Page Defaults</h1>
        <p className="text-sm text-gray-500 mt-1">
          These headers and announcements apply to <strong>all clients</strong> unless overridden on a per-client basis via the Pages editor.
        </p>
      </div>
      {PORTAL_PAGES.map((page) => {
        const c = get(page)
        return (
          <div key={page} className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
            <h2 className="text-sm font-semibold text-gray-700 capitalize">{page.replace(/-/g, " ")}</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Header</label>
                <input
                  value={c.header}
                  onChange={(e) => update(page, "header", e.target.value)}
                  placeholder={`Default header for ${page} (leave blank to use page name)`}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Announcement</label>
                <textarea
                  value={c.announcement}
                  onChange={(e) => update(page, "announcement", e.target.value)}
                  placeholder="Optional announcement shown to all clients on this page"
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => save(page)}
                  disabled={saving === page}
                  className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving === page ? "Saving..." : "Save"}
                </button>
                {saved === page && <span className="text-xs text-green-600 font-medium">Saved</span>}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
