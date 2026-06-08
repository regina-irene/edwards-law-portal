"use client"

import { useRef, useState, useCallback, useEffect } from "react"

export interface DropFile {
  file: File
  id: string
  fileSize: string
  status: "ready" | "uploading" | "done" | "error"
  errorMessage?: string
  progress?: number
  relativePath?: string // e.g. "Bank Statements/jan.pdf" when uploaded as part of a folder
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

type Collected = { file: File; path: string }

// Recursively walk a dropped file/folder entry, collecting files with their relative paths.
function readEntry(entry: any, parentPath: string, out: Collected[]): Promise<void> {
  return new Promise((resolve) => {
    if (!entry) return resolve()
    if (entry.isFile) {
      entry.file(
        (file: File) => { out.push({ file, path: parentPath + file.name }); resolve() },
        () => resolve()
      )
    } else if (entry.isDirectory) {
      const reader = entry.createReader()
      const acc: any[] = []
      const readBatch = () => {
        reader.readEntries(
          (entries: any[]) => {
            if (entries.length === 0) {
              // readEntries returns in batches; empty batch means we're done.
              Promise.all(acc.map((c) => readEntry(c, parentPath + entry.name + "/", out))).then(() => resolve())
            } else {
              acc.push(...entries)
              readBatch()
            }
          },
          () => resolve()
        )
      }
      readBatch()
    } else {
      resolve()
    }
  })
}

export default function FileDropzone({
  files,
  onChange,
  accept = "application/pdf,image/jpeg,image/png,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  maxSize = 26214400,
  formatLabel = "Accepted: PDF, Word, JPG, PNG",
  sizeLabel = "Maximum size: 25 MB",
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)

  // webkitdirectory/directory aren't standard React props; set them on the element directly.
  useEffect(() => {
    if (folderInputRef.current) {
      folderInputRef.current.setAttribute("webkitdirectory", "")
      folderInputRef.current.setAttribute("directory", "")
    }
  }, [])

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

  const addItems = useCallback(
    (incoming: { file: File; relativePath: string }[]) => {
      const next: DropFile[] = incoming.map(({ file, relativePath }) => {
        const id = `f${++counter}`
        const tooBig = file.size > maxSize
        const wrongType = !accepts(file)
        const errors: string[] = []
        if (tooBig) errors.push(`exceeds ${sizeOf(maxSize)}`)
        if (wrongType) errors.push("file type not allowed")
        return {
          file,
          id,
          relativePath,
          fileSize: sizeOf(file.size),
          status: errors.length ? "error" : "ready",
          errorMessage: errors.join(" and ") || undefined,
        }
      })
      onChange([...files, ...next])
    },
    [files, onChange, maxSize, accepts]
  )

  // From a plain file picker (or folder picker, which sets webkitRelativePath on each file).
  const addFiles = useCallback(
    (fs: File[]) => addItems(fs.map((file) => ({ file, relativePath: (file as any).webkitRelativePath || file.name }))),
    [addItems]
  )

  const onDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const dt = e.dataTransfer
    const items = dt.items
    const canTraverse = items && items.length > 0 && typeof (items[0] as any).webkitGetAsEntry === "function"
    if (canTraverse) {
      // Capture entries synchronously — dataTransfer is cleared after this handler returns.
      const entries = Array.from(items).map((it) => (it as any).webkitGetAsEntry()).filter(Boolean)
      const collected: Collected[] = []
      await Promise.all(entries.map((en) => readEntry(en, "", collected)))
      if (collected.length) addItems(collected.map((c) => ({ file: c.file, relativePath: c.path })))
    } else {
      addItems(Array.from(dt.files).map((file) => ({ file, relativePath: (file as any).webkitRelativePath || file.name })))
    }
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
        <p className="text-sm font-medium text-gray-800">Drag &amp; drop files or a folder here</p>
        <p className="text-xs text-gray-600 mt-1">
          <span className="text-blue-600 underline">browse files</span>
          {" or "}
          <span
            className="text-blue-600 underline"
            onClick={(e) => { e.stopPropagation(); folderInputRef.current?.click() }}
          >
            choose a folder
          </span>
        </p>
        <p className="text-xs text-gray-400 mt-1">{formatLabel}</p>
        <p className="text-xs text-gray-400">{sizeLabel}</p>
        <input ref={inputRef} type="file" multiple accept={accept} className="hidden"
          onChange={(e) => { const fs = Array.from(e.target.files ?? []); if (fs.length) addFiles(fs); e.target.value = "" }} />
        <input ref={folderInputRef} type="file" multiple className="hidden"
          onChange={(e) => { const fs = Array.from(e.target.files ?? []); if (fs.length) addFiles(fs); e.target.value = "" }} />
      </div>

      {files.length > 0 && (
        <ul className="mt-4 space-y-2">
          {files.map((f) => (
            <li key={f.id} className={`flex items-center gap-3 px-3 py-2 rounded-lg border ${f.status === "error" ? "border-red-200 bg-red-50" : "border-gray-200 bg-white"}`}>
              <span className="text-lg">{f.status === "error" ? "⚠️" : f.status === "done" ? "✅" : f.relativePath && f.relativePath.includes("/") ? "🗂️" : "📄"}</span>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-gray-800 truncate">{f.relativePath && f.relativePath.includes("/") ? f.relativePath : f.file.name}</p>
                <p className={`text-xs ${f.status === "error" ? "text-red-600" : "text-gray-400"}`}>
                  {f.status === "error" ? f.errorMessage : f.status === "uploading" ? `Uploading… ${f.progress ?? 0}%` : f.status === "done" ? "Uploaded" : f.fileSize}
                </p>
                {f.status === "uploading" && (
                  <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-gray-200">
                    <div className="h-full rounded-full bg-blue-600 transition-all duration-200" style={{ width: `${f.progress ?? 0}%` }} />
                  </div>
                )}
              </div>
              {f.status !== "uploading" && (
                <button aria-label={`Remove ${f.file.name}`} onClick={() => remove(f.id)} className="text-gray-400 hover:text-red-600 text-sm px-1">✕</button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
