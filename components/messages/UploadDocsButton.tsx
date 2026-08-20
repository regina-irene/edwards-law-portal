"use client"
// components/messages/UploadDocsButton.tsx - the "send files" modal: drop or
// browse for documents, watch each one upload, and get a plain confirmation
// that they reached the legal team.
import { useState, useEffect } from "react"
import FileDropzone, { DropFile } from "@/components/ui/FileDropzone"
import { sendFileToFirm, uploadToBlob } from "@/lib/blob-upload-client"
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_LABEL } from "@/lib/upload-limits"

/**
 * The firm's own uploads: into Blob, then ask the server to move them into the
 * shared Drive folder. Same two-step shape as sendFileToFirm, but a different
 * scope on the token and a different finalize route, because nothing about this
 * belongs to a client.
 *
 * Throws with a human sentence. The modal shows it as-is.
 */
async function sendFileToDrive(file: File, onProgress: (percent: number) => void): Promise<void> {
  const blob = await uploadToBlob(file, {
    scope: "admin-upload",
    pathnamePrefix: "admin-uploads",
    onProgress,
  })

  const res = await fetch("/api/admin/file-dropzone/finalize", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url: blob.url, fileName: file.name, contentType: blob.contentType }),
  }).catch(() => null)

  if (!res?.ok) {
    const data = (await res?.json().catch(() => null)) as { error?: string } | null
    throw new Error(data?.error || "That file didn't reach Drive. Please try again.")
  }
}

export default function UploadDocsButton({
  admin = false,
  label = "📁 Upload files",
  buttonClassName = "text-xs px-3 py-1.5 rounded-lg border border-[#1B2D45] text-[#1B2D45] font-medium hover:bg-[#efe7da]",
  heading = "Upload documents",
  blurb = "Files are saved to the firm's Google Drive folder.",
  actionLabel = "Upload to Drive",
  successNote = "You'll also see them listed in your messages, so you can check back any time on what you sent.",
}: {
  /**
   * The firm's own uploader. Files go to the shared Drive folder rather than
   * into a client's folder, and nothing is written to the conversation.
   * Left off, this is the client's "send files to my legal team" modal.
   *
   * This replaced an `endpoint` prop: the browser now uploads to Blob first, so
   * the route a caller wants is the finalize step, not one upload URL.
   */
  admin?: boolean
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

  // Upload one file. The bytes go straight from the browser to Vercel Blob,
  // then the server moves them to Drive (2026-08-20).
  //
  // This used to POST the file into the API route. Vercel rejects a request
  // body over ~4.5 MB with a bare 413 before any of our code runs, so a client
  // sending a document production got "Upload failed / check your connection"
  // while the modal promised 25 MB. Blob has no such ceiling.
  async function uploadOne(f: DropFile): Promise<{ ok: boolean; msg?: string }> {
    const onProgress = (pct: number) =>
      setFiles((prev) => prev.map((x) => (x.id === f.id ? { ...x, progress: Math.round(pct) } : x)))
    try {
      if (admin) {
        await sendFileToDrive(f.file, onProgress)
      } else {
        await sendFileToFirm(f.file, {
          relativePath: f.relativePath || f.file.name,
          onProgress,
        })
      }
      return { ok: true }
    } catch (e) {
      return {
        ok: false,
        msg: e instanceof Error ? e.message : "Upload failed. Please try again.",
      }
    }
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

            {/* The limit comes from lib/upload-limits so the promise on screen
                and the server's check can't drift apart. It said 25 MB while
                the platform silently refused anything over ~4.5 MB. */}
            <FileDropzone
              files={files}
              onChange={setFiles}
              maxSize={MAX_UPLOAD_BYTES}
              sizeLabel={`Maximum size: ${MAX_UPLOAD_LABEL}`}
            />

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
                  {admin
                    ? `✅ ${result.sent} ${result.sent === 1 ? "file is" : "files are"} in the firm's Drive folder.`
                    : `✅ ${result.sent} ${result.sent === 1 ? "file" : "files"} sent - your legal team has ${result.sent === 1 ? "it" : "them"}.`}
                </p>
                {!admin && <p className="text-xs text-green-800 mt-0.5">{successNote}</p>}
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
                  {admin
                    ? "The reason is on each file above. Check the Drive folder and the service account, then try again."
                    : "Please check your connection and try again. If it keeps failing, email us and we'll sort it out."}
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
