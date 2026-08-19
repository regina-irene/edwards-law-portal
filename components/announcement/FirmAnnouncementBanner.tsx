"use client"
// components/announcement/FirmAnnouncementBanner.tsx — FileFlow-style firm
// announcement strip for the ADMIN area: amber banner across the full width
// with 📢 FIRM ANNOUNCEMENTS, edit-in-place (pencil), remove (✕), and an
// "Add firm announcement" affordance when empty.

import { useState } from "react"
import { useRouter } from "next/navigation"
import { RichTextEditor } from "@/components/ui/RichTextEditor"
import { RichTextView } from "@/components/ui/RichTextView"

export default function FirmAnnouncementBanner({ initialHtml }: { initialHtml: string }) {
  const router = useRouter()
  const [saved, setSaved] = useState(initialHtml)
  const [draft, setDraft] = useState(initialHtml)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)

  async function persist(html: string) {
    setSaving(true)
    const res = await fetch("/api/admin/firm-announcement", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ html }),
    })
    setSaving(false)
    if (res.ok) {
      setSaved(html)
      setEditing(false)
      router.refresh()
    }
  }

  // ── empty state ──
  if (!saved && !editing) {
    return (
      <div className="border-b border-dashed border-gray-200 py-1.5 flex justify-center print:hidden">
        <button
          onClick={() => { setDraft(""); setEditing(true) }}
          className="text-xs text-gray-400 hover:text-amber-600 transition-colors flex items-center gap-1"
        >
          <span className="text-sm leading-none">📢 +</span> Add firm announcement
        </button>
      </div>
    )
  }

  // ── edit mode ──
  if (editing) {
    return (
      <div className="border-b border-amber-300 bg-amber-50 px-4 sm:px-6 py-2 print:hidden">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-base">📢</span>
          <span className="text-xs font-semibold text-amber-700 uppercase tracking-wide">Firm Announcement</span>
        </div>
        <div className="bg-white rounded-lg shadow-sm">
          <RichTextEditor value={draft} onChange={setDraft} />
        </div>
        <div className="flex items-center gap-2 mt-2 justify-end">
          <button
            onClick={() => { setDraft(saved); setEditing(false) }}
            className="text-xs text-slate-500 hover:text-slate-700 px-3 py-1.5 rounded-md hover:bg-slate-100 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => persist(draft)}
            disabled={saving}
            className="text-xs font-semibold bg-amber-500 hover:bg-amber-600 text-white px-4 py-1.5 rounded-md transition-colors disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    )
  }

  // ── display mode ──
  return (
    <div className="border-b border-amber-200/60 bg-amber-50/50 px-4 sm:px-6 py-2.5 print:hidden">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-base">📢</span>
          <span className="text-xs font-bold text-amber-700 uppercase tracking-wide">Firm Announcements</span>
        </div>
        <span className="text-amber-300 shrink-0">|</span>
        <div className="flex-1 min-w-0 text-sm text-amber-900 text-center [&_div]:!text-center [&_p]:!text-center">
          <RichTextView html={saved} className="!text-amber-900" />
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => { setDraft(saved); setEditing(true) }}
            title="Edit announcement"
            className="p-1 text-amber-400 hover:text-amber-600 hover:bg-amber-100 rounded transition-colors"
          >
            ✏️
          </button>
          <button
            onClick={() => persist("")}
            title="Remove announcement"
            className="p-1 text-amber-300 hover:text-red-400 hover:bg-red-50 rounded transition-colors"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  )
}

// The display-only client-portal strip (FirmAnnouncementView) lives in
// components/announcement/FirmAnnouncementView.tsx so client pages don't pull
// in the editor and the admin save logic above.
