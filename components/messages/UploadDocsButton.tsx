"use client"

import { useState } from "react"
import FileDropzone, { DropFile } from "@/components/ui/FileDropzone"

export default function UploadDocsButton({
  endpoint = "/api/admin/file-dropzone",
  label = "📁 Upload files",
  buttonClassName = "text-xs px-3 py-1.5 rounded-lg border border-[#1B2D45] text-[#1B2D45] font-medium hover:bg-[#efe7da]",
  heading = "Upload documents",
  blurb = "Files are saved to the firm's Google Drive folder.",
  actionLabel = "Upload to Drive",
}: {
  endpoint?: string
  label?: string
  buttonClassName?: string
  heading?: string
  blurb?: string
  actionLabel?: string
} = {}) {
  const [open, setOpen] = useState(false)
  const [files, setFiles] = useState<DropFile[]>([])
  const [uploading, setUploading] = useState(false)

  async function upload() {
    setUploading(true)
    for (const f of files) {
      if (f.status !== "ready") continue
      setFiles((prev) => prev.map((x) => (x.id === f.id ? { ...x, status: "uploading" } : x)))
      const fd = new FormData()
      fd.append("file", f.file)
      let ok = false
      let msg = "Upload failed"
      try {
        const res = await fetch(endpoint, { method: "POST", body: fd })
        ok = res.ok
        if (!ok) { const d = await res.json().catch(() => ({})); msg = d.error || msg }
      } catch { /* network */ }
      setFiles((prev) => prev.map((x) => (x.id === f.id ? { ...x, status: ok ? "done" : "error", errorMessage: ok ? undefined : msg } : x)))
    }
    setUploading(false)
  }

  const pending = files.filter((f) => f.status === "ready").length

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={buttonClassName}>
        {label}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={() => !uploading && setOpen(false)}>
          <div className="bg-white rounded-2xl border border-gray-200 w-full max-w-lg p-5 max-h-[85vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-1">
              <h2 className="serif text-lg font-semibold text-gray-900">{heading}</h2>
              <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-700">✕</button>
            </div>
            <p className="text-xs text-gray-500 mb-4">{blurb}</p>

            <FileDropzone files={files} onChange={setFiles} />

            <div className="flex items-center justify-end gap-3 mt-5 pt-3 border-t border-gray-100">
              <button onClick={() => setOpen(false)} className="text-sm text-gray-500 hover:underline">Close</button>
              <button onClick={upload} disabled={uploading || pending === 0} className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50">
                {uploading ? "Uploading…" : `${actionLabel}${pending ? ` (${pending})` : ""}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
