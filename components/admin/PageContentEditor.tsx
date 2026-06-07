"use client"

import { useState, useEffect } from "react"
import { PORTAL_PAGES } from "@/lib/pages"
import { RichTextEditor } from "@/components/ui/RichTextEditor"

interface PC {
  header: string
  announcement: string
  embed_url: string
  body: string
  image_name: string
}
type ContentMap = Record<string, PC>

const EMPTY: PC = { header: "", announcement: "", embed_url: "", body: "", image_name: "" }

export default function PageContentEditor({ clientId }: { clientId: string }) {
  const [content, setContent] = useState<ContentMap>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [saved, setSaved] = useState<string | null>(null)
  const [uploading, setUploading] = useState<string | null>(null)

  function load() {
    return fetch(`/api/admin/page-content?clientId=${encodeURIComponent(clientId)}`)
      .then((r) => r.json())
      .then((d) => setContent(d.content ?? {}))
      .catch(() => {})
  }

  useEffect(() => {
    setLoading(true)
    load().finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId])

  const get = (page: string): PC => content[page] ?? EMPTY
  const update = (page: string, field: keyof PC, value: string) =>
    setContent((p) => ({ ...p, [page]: { ...get(page), [field]: value } }))

  async function save(page: string) {
    setSaving(page)
    const c = get(page)
    const res = await fetch("/api/admin/page-content", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId, page, header: c.header, announcement: c.announcement, embed_url: c.embed_url, body: c.body }),
    })
    setSaving(null)
    if (res.ok) { setSaved(page); setTimeout(() => setSaved(null), 2000) }
  }

  async function uploadImage(page: string, file: File) {
    setUploading(page)
    const fd = new FormData()
    fd.append("file", file)
    fd.append("clientId", clientId)
    fd.append("page", page)
    const res = await fetch("/api/admin/page-image", { method: "POST", body: fd })
    setUploading(null)
    if (res.ok) load()
    else alert("Image upload failed (images only, max 10MB).")
  }

  async function removeImage(page: string) {
    await fetch("/api/admin/page-image", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId, page }),
    })
    load()
  }

  const inputCls = "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
  const labelCls = "block text-xs font-medium text-gray-500 mb-1"

  if (loading) return <p className="text-gray-400 text-sm">Loading…</p>

  return (
    <div className="space-y-8">
      {PORTAL_PAGES.map((page) => {
        const c = get(page)
        return (
          <div key={page} className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
            <h2 className="text-sm font-semibold text-gray-700 capitalize">{page.replace(/-/g, " ")}</h2>

            <div>
              <label className={labelCls}>Header (page title)</label>
              <input value={c.header} onChange={(e) => update(page, "header", e.target.value)} placeholder="Leave blank to use the page name" className={inputCls} />
            </div>

            <div>
              <label className={labelCls}>Announcement (shown in a highlighted banner)</label>
              <RichTextEditor key={`${page}-ann`} value={c.announcement} onChange={(v) => update(page, "announcement", v)} />
            </div>

            <div>
              <label className={labelCls}>Embedded table URL (Airtable embed link)</label>
              <input value={c.embed_url} onChange={(e) => update(page, "embed_url", e.target.value)} placeholder="https://airtable.com/embed/…" className={inputCls} />
            </div>

            <div>
              <label className={labelCls}>Content section (free-form text)</label>
              <RichTextEditor key={`${page}-body`} value={c.body} onChange={(v) => update(page, "body", v)} />
            </div>

            <div>
              <label className={labelCls}>Banner image (saves immediately)</label>
              {c.image_name ? (
                <div className="flex items-center gap-3 mb-1">
                  <span className="text-sm text-gray-700">🖼️ {c.image_name}</span>
                  <button onClick={() => removeImage(page)} className="text-xs text-gray-300 hover:text-red-600">Remove</button>
                </div>
              ) : (
                <p className="text-xs text-gray-400 mb-1">No image.</p>
              )}
              <label className="inline-flex items-center gap-2 text-sm text-blue-600 cursor-pointer hover:underline">
                {uploading === page ? "Uploading…" : "+ Upload image"}
                <input type="file" accept="image/*" className="hidden" disabled={uploading === page}
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadImage(page, f); e.target.value = "" }} />
              </label>
            </div>

            <div className="flex items-center gap-3 pt-1 border-t border-gray-100">
              <button onClick={() => save(page)} disabled={saving === page} className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50">
                {saving === page ? "Saving…" : "Save"}
              </button>
              {saved === page && <span className="text-xs text-green-600 font-medium">Saved</span>}
            </div>
          </div>
        )
      })}
    </div>
  )
}
