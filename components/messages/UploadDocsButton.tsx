"use client"
// components/messages/UploadDocsButton.tsx - the "send files" modal: drop or
// browse for documents, watch each one upload, and get a plain confirmation
// that they reached the legal team.
import { useState, useEffect } from "react"
import FileDropzone, { DropFile } from "@/components/ui/FileDropzone"

export default function UploadDocsButton({
  endpoint = "/api/admin/file-dropzone",
  label = "📁 Upload files",
  buttonClassName = "text-xs px-3 py-1.5 rounded-lg border border-[#1B2D45] text-[#1B2D45] font-medium hover:bg-[#efe7da]",
  heading = "Upload documents",
  blurb = "Files are saved to the firm's Google Drive folder.",
  actionLabel = "Upload to Drive",
  successNote = "You'll also see them listed in your messages, so you can check back any time on what you sent.",
}: {
  endpoint?: string
  label?: string
  buttonClassName?: string
  heading?: string
  blurb?: string
  actionLabel?: string
  successNote?: string
} = {}) {
  const [open, setOpen] = useState(false)
  const [files, setFiles] = useState<DropFile[]>([])
  const [uploading, setUploading] = useState(false)
  // What the last run actually managed, so the modal can say so instead of
  // leaving the client guessing whether anything arrived.
  const [result, setResult] = useState<{ sent: number; failed: number } | null>(null)

  // While files are uploading, warn the user if they try to close or navigate away.
  useEffect(() => {
    if (!uploading) return
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = "" }
    window.addEventListener("beforeunload", warn)
    return () => window.removeEventListener("beforeunload", warn)
  }, [uploading])

  // Upload one file via XMLHttpRequest so we can report real progress.
  function uploadOne(f: DropFile): Promise<{ ok: boolean; msg?: string }> {
    return new Promise((resolve) => {
      const xhr = new XMLHttpRequest()
      xhr.open("POST", endpoint)
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          const pct = Math.round((e.loaded / e.total) * 100)
          setFiles((prev) => prev.map((x) => (x.id === f.id ? { ...x, progress: pct } : x)))
        }
      }
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve({ ok: true })
        } else {
          let msg = "Upload failed"
          try { const d = JSON.parse(xhr.responseText); msg = d.error || msg } catch { /* non-JSON */ }
          resolve({ ok: false, msg })
        }
      }
      xhr.onerror = () => resolve({ ok: false, msg: "Upload failed. Please check your connection and try again." })
      const fd = new FormData()
      fd.append("file", f.file)
      fd.append("relativePath", f.relativePath || f.file.name)
      xhr.send(fd)
    })
  }

  async function upload() {
    setUploading(true)
    setResult(null)
    let sent = 0
    let failed = 0
    for (const f of files) {
      if (f.status !== "ready") continue
      setFiles((prev) => prev.map((x) => (x.id === f.id ? { ...x, status: "uploading", progress: 0 } : x)))
      const { ok, msg } = await uploadOne(f)
      if (ok) sent++
      else failed++
      setFiles((prev) => prev.map((x) => (x.id === f.id ? { ...x, status: ok ? "done" : "error", progress: ok ? 100 : x.progress, errorMessage: ok ? undefined : msg } : x)))
    }
    setUploading(false)
    setResult({ sent, failed })
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
              <button onClick={() => setOpen(false)} disabled={uploading} className="text-gray-400 hover:text-gray-700 disabled:opacity-40 disabled:cursor-not-allowed">✕</button>
            </div>
            <p className="text-xs text-gray-500 mb-4">{blurb}</p>

            <FileDropzone files={files} onChange={setFiles} />

            {uploading && (
              <div className="mt-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                <span className="text-base leading-none">⏳</span>
                <p className="text-xs text-amber-800">
                  Uploading… please keep this window open and don&apos;t close or leave the page until your files finish.
                </p>
              </div>
            )}

            {!uploading && result && result.sent > 0 && (
              <div className="mt-4 rounded-lg border border-green-200 bg-green-50 px-3 py-2.5">
                <p className="text-sm font-semibold text-green-900">
                  ✅ {result.sent} {result.sent === 1 ? "file" : "files"} sent - your legal team has {result.sent === 1 ? "it" : "them"}.
                </p>
                <p className="text-xs text-green-800 mt-0.5">{successNote}</p>
                {result.failed > 0 && (
                  <p className="text-xs text-amber-800 mt-1.5">
                    {result.failed} {result.failed === 1 ? "file didn't" : "files didn't"} go through - {result.failed === 1 ? "it's" : "they're"} marked above. You can try again.
                  </p>
                )}
              </div>
            )}

            {!uploading && result && result.sent === 0 && result.failed > 0 && (
              <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5">
                <p className="text-sm font-semibold text-red-900">Nothing was sent.</p>
                <p className="text-xs text-red-800 mt-0.5">
                  Please check your connection and try again. If it keeps failing, email us and we&apos;ll sort it out.
                </p>
              </div>
            )}

            <div className="flex items-center justify-end gap-3 mt-5 pt-3 border-t border-gray-100">
              <button onClick={() => setOpen(false)} disabled={uploading} className="text-sm text-gray-500 hover:underline disabled:opacity-40 disabled:cursor-not-allowed disabled:no-underline">Close</button>
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
