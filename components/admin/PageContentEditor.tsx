"use client"
// components/admin/PageContentEditor.tsx - edits the title, announcement,
// embed, content and banner image of each portal page, globally or for one
// client.
import { useState, useEffect } from "react"
import { RichTextEditor } from "@/components/ui/RichTextEditor"
import { InlineError } from "@/components/ui/InlineError"

interface PC {
  header: string
  announcement: string
  embed_url: string
  embed_height: number | string | null
  body: string
  image_name: string
}
type ContentMap = Record<string, PC>

const EMPTY: PC = { header: "", announcement: "", embed_url: "", embed_height: "", body: "", image_name: "" }

export default function PageContentEditor({ clientId, allowRename = false, layout = "accordion" }: { clientId: string; allowRename?: boolean; layout?: "accordion" | "tabs" }) {
  const isGlobal = clientId === "_global"
  const [content, setContent] = useState<ContentMap>({})
  const [globalContent, setGlobalContent] = useState<ContentMap>({})
  const [pageList, setPageList] = useState<{ key: string; label: string }[]>([])
  const [openKey, setOpenKey] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [saved, setSaved] = useState<string | null>(null)
  const [uploading, setUploading] = useState<string | null>(null)
  // Holds the page key whose banner image wouldn't upload, so the reason shows
  // next to that page's upload button instead of in a browser alert.
  const [imageError, setImageError] = useState<string | null>(null)
  const [renaming, setRenaming] = useState<string | null>(null)
  const [renameDraft, setRenameDraft] = useState("")
  const [hidden, setHidden] = useState<Set<string>>(new Set())

  function loadContent() {
    return fetch(`/api/admin/page-content?clientId=${encodeURIComponent(clientId)}`)
      .then((r) => r.json())
      .then((d) => setContent(d.content ?? {}))
      .catch(() => {})
  }
  function loadPages() {
    return fetch(`/api/admin/client-pages?clientId=${encodeURIComponent(clientId)}`)
      .then((r) => r.json())
      .then((d) => {
        setPageList((d.pages ?? []).map((p: { key: string; label: string }) => ({ key: p.key, label: p.label })))
        setHidden(new Set(d.hidden ?? []))
      })
      .catch(() => {})
  }

  async function toggleVisible(page: string, visible: boolean) {
    setHidden((prev) => {
      const n = new Set(prev)
      if (visible) n.delete(page)
      else n.add(page)
      return n
    })
    await fetch("/api/admin/client-pages", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId, pageKey: page, hidden: !visible }),
    })
  }

  useEffect(() => {
    setLoading(true)
    const jobs: Promise<unknown>[] = [loadContent(), loadPages()]
    if (!isGlobal) {
      jobs.push(
        fetch(`/api/admin/page-content?clientId=_global`).then((r) => r.json()).then((d) => setGlobalContent(d.content ?? {})).catch(() => {})
      )
    }
    Promise.all(jobs).finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId])

  function copyFromGlobal(page: string) {
    const g = globalContent[page] ?? EMPTY
    setContent((p) => ({
      ...p,
      [page]: { ...get(page), header: g.header, announcement: g.announcement, embed_url: g.embed_url, embed_height: g.embed_height, body: g.body },
    }))
  }

  const get = (page: string): PC => content[page] ?? EMPTY
  const update = (page: string, field: keyof PC, value: string) =>
    setContent((p) => ({ ...p, [page]: { ...get(page), [field]: value } }))

  async function save(page: string) {
    setSaving(page)
    const c = get(page)
    const res = await fetch("/api/admin/page-content", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId, page, header: c.header, announcement: c.announcement, embed_url: c.embed_url, embed_height: c.embed_height, body: c.body }),
    })
    setSaving(null)
    if (res.ok) { setSaved(page); setTimeout(() => setSaved(null), 2000) }
  }

  async function saveRename(page: string) {
    const label = renameDraft.trim()
    if (!label) { setRenaming(null); return }
    const res = await fetch("/api/admin/page-name", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pageKey: page, label }),
    })
    setRenaming(null)
    if (res.ok) loadPages()
  }

  async function uploadImage(page: string, file: File) {
    setUploading(page)
    setImageError(null)
    const fd = new FormData()
    fd.append("file", file); fd.append("clientId", clientId); fd.append("page", page)
    const res = await fetch("/api/admin/page-image", { method: "POST", body: fd }).catch(() => null)
    setUploading(null)
    if (res?.ok) loadContent()
    else setImageError(page)
  }
  async function removeImage(page: string) {
    await fetch("/api/admin/page-image", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ clientId, page }) })
    loadContent()
  }

  const inputCls = "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
  const labelCls = "block text-xs font-medium text-gray-500 mb-1"

  // Pages that render their own live content don't need a content section or
  // banner image on the GLOBAL editor (per Regina).
  const GLOBAL_TITLE_ANNOUNCEMENT_ONLY = new Set(["pleadings", "correspondence", "discovery", "status", "tasks", "messages", "calendar"])

  // the editor fields for one page - shared by the accordion and tab layouts.
  // The embed field is hidden on the GLOBAL editor (per Regina) - pages render
  // their own live content now; per-client overrides can still set an embed.
  function editorBody(page: string) {
    const c = get(page)
    const showEmbed = !isGlobal
    const showBodyAndImage = !(isGlobal && GLOBAL_TITLE_ANNOUNCEMENT_ONLY.has(page))
    return (
      <div className="px-4 pb-5 pt-3 space-y-4 border-t border-gray-100">
        {!isGlobal && (
          <div className="flex items-center justify-between gap-3 pb-2">
            <p className="text-[11px] text-gray-400">Blank fields use the global default.</p>
            <button onClick={() => copyFromGlobal(page)} className="text-xs font-medium text-blue-600 hover:underline">Copy from global ↧</button>
          </div>
        )}
        <div>
          <label className={labelCls}>Page title (shown at top of the page)</label>
          <input value={c.header} onChange={(e) => update(page, "header", e.target.value)} placeholder="Leave blank to use the page name" className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Announcement (highlighted banner)</label>
          <RichTextEditor key={`${page}-ann`} value={c.announcement} onChange={(v) => update(page, "announcement", v)} />
        </div>
        {showEmbed && (
          <div>
            <label className={labelCls}>Embed a link (web page, another project, or Airtable table)</label>
            <input value={c.embed_url} onChange={(e) => update(page, "embed_url", e.target.value)} placeholder="https://… - shows inside this page" className={inputCls} />
            <p className="text-[11px] text-gray-400 mt-1">Paste any link to display it embedded in the page. (Some sites block embedding; if it appears blank, a link to open it is shown instead.)</p>
            <div className="mt-2 flex items-center gap-2">
              <label className="text-xs text-gray-500">Embed height (px)</label>
              <input type="number" min={150} max={2000} value={c.embed_height ?? ""} onChange={(e) => update(page, "embed_height", e.target.value)} placeholder="600" className="w-28 px-2 py-1 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <span className="text-[11px] text-gray-400">Lower = shorter box. Blank = default (600).</span>
            </div>
          </div>
        )}
        {showBodyAndImage && (
        <div>
          <label className={labelCls}>Content section</label>
          <RichTextEditor key={`${page}-body`} value={c.body} onChange={(v) => update(page, "body", v)} />
        </div>
        )}
        {showBodyAndImage && (
        <div>
          <label className={labelCls}>Banner image (saves immediately)</label>
          {c.image_name ? (
            <div className="flex items-center gap-3 mb-1">
              <span className="text-sm text-gray-700">🖼️ {c.image_name}</span>
              <button onClick={() => removeImage(page)} className="text-xs text-gray-300 hover:text-red-600">Remove</button>
            </div>
          ) : <p className="text-xs text-gray-400 mb-1">No image.</p>}
          <label className="inline-flex items-center gap-2 text-sm text-blue-600 cursor-pointer hover:underline">
            {uploading === page ? "Uploading…" : "+ Upload image"}
            <input type="file" accept="image/*" className="hidden" disabled={uploading === page}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadImage(page, f); e.target.value = "" }} />
          </label>
          {imageError === page && <InlineError message="That image didn't upload - images only, up to 10 MB." />}
        </div>
        )}
        <div className="flex items-center gap-3 pt-1 border-t border-gray-100">
          <button onClick={() => save(page)} disabled={saving === page} className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50">
            {saving === page ? "Saving…" : "Save"}
          </button>
          {saved === page && <span className="text-xs text-green-600 font-medium">Saved</span>}
        </div>
      </div>
    )
  }

  if (loading) return <p className="text-gray-400 text-sm">Loading…</p>

  // ── Tab layout: one page at a time, picked from a tab bar ──
  if (layout === "tabs") {
    const selected = openKey && pageList.some((p) => p.key === openKey) ? openKey : pageList[0]?.key
    const selectedLabel = pageList.find((p) => p.key === selected)?.label ?? selected
    if (!selected) return <p className="text-gray-400 text-sm">No pages found.</p>
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap gap-1.5">
          {pageList.map(({ key: page, label }) => (
            <button
              key={page}
              onClick={() => setOpenKey(page)}
              className={`px-3.5 py-1.5 rounded-full text-sm border transition-colors ${page === selected ? "bg-[#1B2D45] text-white border-[#1B2D45] font-semibold" : "bg-white border-gray-300 text-gray-600 hover:border-gray-500"} ${hidden.has(page) ? "opacity-50" : ""}`}
              title={hidden.has(page) ? "Hidden from clients by default" : undefined}
            >
              {label}{hidden.has(page) ? " 🚫" : ""}
            </button>
          ))}
        </div>
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="flex items-center gap-3 px-4 py-3">
            <input
              type="checkbox"
              checked={!hidden.has(selected)}
              onChange={(e) => toggleVisible(selected, e.target.checked)}
              title={hidden.has(selected) ? "Hidden by default - check to show to clients" : "Shown to clients by default"}
              className="w-4 h-4 accent-blue-600 flex-shrink-0"
            />
            {renaming === selected ? (
              <div className="flex items-center gap-2 flex-1">
                <input autoFocus value={renameDraft} onChange={(e) => setRenameDraft(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") saveRename(selected); if (e.key === "Escape") setRenaming(null) }}
                  className="text-sm font-medium border border-gray-300 rounded px-2 py-1 flex-1 max-w-xs" />
                <button onClick={() => saveRename(selected)} className="text-xs text-blue-600 hover:underline">Save</button>
                <button onClick={() => setRenaming(null)} className="text-xs text-gray-400 hover:underline">Cancel</button>
              </div>
            ) : (
              <span className="text-base font-semibold text-gray-800 flex-1">{selectedLabel}</span>
            )}
            {allowRename && renaming !== selected && (
              <button onClick={() => { setRenaming(selected); setRenameDraft(selectedLabel ?? "") }} className="text-xs text-gray-400 hover:text-blue-600 hover:underline">Rename</button>
            )}
          </div>
          {editorBody(selected)}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {pageList.map(({ key: page, label }) => {
        const open = openKey === page
        return (
          <div key={page} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-3">
              <input
                type="checkbox"
                checked={!hidden.has(page)}
                onChange={(e) => toggleVisible(page, e.target.checked)}
                title={
                  isGlobal
                    ? hidden.has(page) ? "Hidden by default - check to show to clients" : "Shown to clients by default"
                    : hidden.has(page) ? "Hidden from this client - check to show" : "Visible to this client"
                }
                className="w-4 h-4 accent-blue-600 flex-shrink-0"
              />
              {renaming === page ? (
                <div className="flex items-center gap-2 flex-1">
                  <input autoFocus value={renameDraft} onChange={(e) => setRenameDraft(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") saveRename(page); if (e.key === "Escape") setRenaming(null) }}
                    className="text-sm font-medium border border-gray-300 rounded px-2 py-1 flex-1 max-w-xs" />
                  <button onClick={() => saveRename(page)} className="text-xs text-blue-600 hover:underline">Save</button>
                  <button onClick={() => setRenaming(null)} className="text-xs text-gray-400 hover:underline">Cancel</button>
                </div>
              ) : (
                <button onClick={() => setOpenKey(open ? null : page)} className="flex items-center gap-2 flex-1 text-left">
                  <span className="text-gray-400 text-xs">{open ? "▼" : "▶"}</span>
                  <span className="text-sm font-semibold text-gray-800">{label}</span>
                </button>
              )}
              <div className="flex items-center gap-3 flex-shrink-0">
                {allowRename && renaming !== page && (
                  <button onClick={() => { setRenaming(page); setRenameDraft(label) }} className="text-xs text-gray-400 hover:text-blue-600 hover:underline">Rename</button>
                )}
                <button onClick={() => setOpenKey(open ? null : page)} className="text-xs text-blue-600 hover:underline">{open ? "Close" : "Edit"}</button>
              </div>
            </div>

            {open && editorBody(page)}
          </div>
        )
      })}
    </div>
  )
}
