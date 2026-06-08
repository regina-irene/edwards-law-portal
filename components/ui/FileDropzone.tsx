"use client"

import { useRef, useState, useCallback } from "react"

export interface DropFile {
  file: File
  id: string
  fileSize: string
  status: "ready" | "uploading" | "done" | "error"
  errorMessage?: string
  progress?: number
}

function sizeOf(bytes: number) {
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

interface Props {
  files: DropFile[]
  onChange: (files: DropFile[]) => void
  accept?: string // comma list of mime types / extensions
  maxSize?: number // bytes
  formatLabel?: string
  sizeLabel?: string
}

let counter = 0

export default function FileDropzone({
  files,
  onChange,
  accept = "application/pdf,image/jpeg,image/png,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  maxSize = 26214400,
  formatLabel = "Accepted: PDF, Word, JPG, PNG",
  sizeLabel = "Maximum size: 25 MB",
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)

  const acceptList = accept.split(",").map((s) => s.trim()).filter(Boolean)

  const accepts = useCallback(
    (file: File) => {
      if (acceptList.length === 0) return true
      return acceptList.some((a) => {
        if (a.startsWith(".")) return file.name.toLowerCase().endsWith(a.toLowerCase())
        if (a.endsWith("/*")) return file.type.startsWith(a.slice(0, -1))
        return file.type === a
      })
    },
    [acceptList]
  )

  const addFiles = useCallback(
    (incoming: File[]) => {
      const next: DropFile[] = incoming.map((file) => {
        const id = `f${++counter}`
        const tooBig = file.size > maxSize
        const wrongType = !accepts(file)
        const errors: string[] = []
        if (tooBig) errors.push(`exceeds ${sizeOf(maxSize)}`)
        if (wrongType) errors.push("file type not allowed")
        return {
          file,
          id,
          fileSize: sizeOf(file.size),
          status: errors.length ? "error" : "ready",
          errorMessage: errors.join(" and ") || undefined,
        }
      })
      onChange([...files, ...next])
    },
    [files, onChange, maxSize, accepts]
  )

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    addFiles(Array.from(e.dataTransfer.files))
  }

  const remove = (id: string) => onChange(files.filter((f) => f.id !== id))

  return (
    <div>
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={`cursor-pointer rounded-xl border-2 border-dashed px-6 py-8 text-center transition-colors ${dragOver ? "border-[#1B2D45] bg-[#efe7da]" : "border-gray-300 bg-[#FBF8F3] hover:border-gray-400"}`}
      >
        <div className="text-3xl mb-2">⬆️</div>
        <p className="text-sm font-medium text-gray-800">
          Drag &amp; drop files here, or <span className="text-blue-600 underline">browse</span>
        </p>
        <p className="text-xs text-gray-400 mt-1">{formatLabel}</p>
        <p className="text-xs text-gray-400">{sizeLabel}</p>
        <input ref={inputRef} type="file" multiple accept={accept} className="hidden"
          onChange={(e) => { const fs = Array.from(e.target.files ?? []); if (fs.length) addFiles(fs); e.target.value = "" }} />
      </div>

      {files.length > 0 && (
        <ul className="mt-4 space-y-2">
          {files.map((f) => (
            <li key={f.id} className={`flex items-center gap-3 px-3 py-2 rounded-lg border ${f.status === "error" ? "border-red-200 bg-red-50" : "border-gray-200 bg-white"}`}>
              <span className="text-lg">{f.status === "error" ? "⚠️" : f.status === "done" ? "✅" : "📄"}</span>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-gray-800 truncate">{f.file.name}</p>
                <p className={`text-xs ${f.status === "error" ? "text-red-600" : "text-gray-400"}`}>
                  {f.status === "error" ? f.errorMessage : f.status === "uploading" ? `Uploading… ${f.progress ?? 0}%` : f.status === "done" ? "Uploaded" : f.fileSize}
                </p>
              </div>
              <button aria-label={`Remove ${f.file.name}`} onClick={() => remove(f.id)} className="text-gray-400 hover:text-red-600 text-sm px-1">✕</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
