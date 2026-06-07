"use client"

import { useRef, useEffect, useState } from "react"

// Full WYSIWYG editor: formatting, alignment, color, highlight, font size,
// indent, lists, headings, links, and inline image upload.
export function RichTextEditor({
  value,
  onChange,
}: {
  value: string
  onChange: (html: string) => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const savedRange = useRef<Range | null>(null)
  const selectedImg = useRef<HTMLImageElement | null>(null)
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    if (ref.current) ref.current.innerHTML = value || ""
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function emit() {
    if (ref.current) onChange(ref.current.innerHTML)
  }

  function saveSelection() {
    const sel = window.getSelection()
    if (sel && sel.rangeCount > 0 && ref.current?.contains(sel.anchorNode)) {
      savedRange.current = sel.getRangeAt(0)
    }
  }

  function restoreSelection() {
    const sel = window.getSelection()
    ref.current?.focus()
    if (savedRange.current && sel) {
      sel.removeAllRanges()
      sel.addRange(savedRange.current)
    }
  }

  function exec(cmd: string, arg?: string) {
    try { document.execCommand("styleWithCSS", false, "true") } catch {}
    document.execCommand(cmd, false, arg)
    emit()
  }

  function execWithRestore(cmd: string, arg: string) {
    restoreSelection()
    try { document.execCommand("styleWithCSS", false, "true") } catch {}
    document.execCommand(cmd, false, arg)
    emit()
  }

  // Align — if an image is selected, position the image directly; otherwise
  // align the text block.
  function align(dir: "left" | "center" | "right" | "justify") {
    const img = selectedImg.current
    if (img && ref.current?.contains(img)) {
      img.style.float = "none"
      img.style.marginLeft = ""
      img.style.marginRight = ""
      if (dir === "center") {
        img.style.display = "block"
        img.style.marginLeft = "auto"
        img.style.marginRight = "auto"
      } else if (dir === "left") {
        img.style.display = "inline"
        img.style.float = "left"
        img.style.marginRight = "1rem"
      } else if (dir === "right") {
        img.style.display = "inline"
        img.style.float = "right"
        img.style.marginLeft = "1rem"
      } else {
        img.style.display = ""
      }
      emit()
      return
    }
    exec(dir === "center" ? "justifyCenter" : dir === "right" ? "justifyRight" : dir === "left" ? "justifyLeft" : "justifyFull")
  }

  function addLink() {
    saveSelection()
    const url = window.prompt("Link URL (https://...)")
    if (url) { restoreSelection(); exec("createLink", url.trim()) }
  }

  async function onImagePicked(file: File) {
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append("file", file)
      const res = await fetch("/api/admin/content-image", { method: "POST", body: fd })
      if (!res.ok) { alert("Image upload failed (images only, max 10MB)."); return }
      const { url } = await res.json()
      restoreSelection()
      exec("insertImage", url)
    } finally {
      setUploading(false)
    }
  }

  const btn = "px-2 py-1 text-sm rounded hover:bg-gray-200 text-gray-700"
  const Divider = () => <span className="w-px h-5 bg-gray-300 mx-1" />
  const hold = (fn: () => void) => (e: React.MouseEvent) => { e.preventDefault(); fn() }

  return (
    <div className="border border-gray-300 rounded-lg overflow-hidden">
      <div className="flex items-center gap-0.5 flex-wrap border-b border-gray-200 bg-gray-50 px-2 py-1">
        <button type="button" title="Bold" onMouseDown={hold(() => exec("bold"))} className={`${btn} font-bold`}>B</button>
        <button type="button" title="Italic" onMouseDown={hold(() => exec("italic"))} className={`${btn} italic`}>I</button>
        <button type="button" title="Underline" onMouseDown={hold(() => exec("underline"))} className={`${btn} underline`}>U</button>
        <button type="button" title="Strikethrough" onMouseDown={hold(() => exec("strikeThrough"))} className={`${btn} line-through`}>S</button>
        <Divider />

        <label title="Text color" className="flex items-center gap-1 px-1 cursor-pointer" onMouseDown={saveSelection}>
          <span className="text-sm font-bold text-gray-700">A</span>
          <input type="color" defaultValue="#111827" className="w-5 h-5 p-0 border-0 bg-transparent cursor-pointer"
            onChange={(e) => execWithRestore("foreColor", e.target.value)} />
        </label>
        <label title="Highlight" className="flex items-center gap-1 px-1 cursor-pointer" onMouseDown={saveSelection}>
          <span className="text-sm text-gray-700">🖍️</span>
          <input type="color" defaultValue="#fef08a" className="w-5 h-5 p-0 border-0 bg-transparent cursor-pointer"
            onChange={(e) => execWithRestore("hiliteColor", e.target.value)} />
        </label>
        <select title="Font size" defaultValue="" onMouseDown={saveSelection}
          onChange={(e) => { execWithRestore("fontSize", e.target.value); e.target.value = "" }}
          className="text-sm rounded px-1 py-1 bg-transparent hover:bg-gray-200 text-gray-700">
          <option value="" disabled>Size</option>
          <option value="2">Small</option>
          <option value="3">Normal</option>
          <option value="5">Large</option>
          <option value="7">Huge</option>
        </select>
        <Divider />

        <button type="button" title="Align left (or float image left)" onMouseDown={hold(() => align("left"))} className={btn}>⫷</button>
        <button type="button" title="Align center (or center image)" onMouseDown={hold(() => align("center"))} className={btn}>☰</button>
        <button type="button" title="Align right (or float image right)" onMouseDown={hold(() => align("right"))} className={btn}>⫸</button>
        <button type="button" title="Justify" onMouseDown={hold(() => align("justify"))} className={btn}>▤</button>
        <Divider />

        <button type="button" title="Bulleted list" onMouseDown={hold(() => exec("insertUnorderedList"))} className={btn}>• List</button>
        <button type="button" title="Numbered list" onMouseDown={hold(() => exec("insertOrderedList"))} className={btn}>1. List</button>
        <button type="button" title="Decrease indent" onMouseDown={hold(() => exec("outdent"))} className={btn}>⇤</button>
        <button type="button" title="Increase indent" onMouseDown={hold(() => exec("indent"))} className={btn}>⇥</button>
        <Divider />

        <select title="Text style" defaultValue="" onMouseDown={saveSelection}
          onChange={(e) => { execWithRestore("formatBlock", e.target.value); e.target.value = "" }}
          className="text-sm rounded px-1 py-1 bg-transparent hover:bg-gray-200 text-gray-700">
          <option value="" disabled>Style</option>
          <option value="H2">Heading</option>
          <option value="H3">Subheading</option>
          <option value="P">Normal</option>
        </select>
        <Divider />

        <button type="button" title="Add link" onMouseDown={hold(addLink)} className={btn}>🔗 Link</button>
        <button type="button" title="Remove link" onMouseDown={hold(() => exec("unlink"))} className={btn}>⛌</button>
        <button type="button" title="Insert image" onMouseDown={hold(() => { saveSelection(); fileRef.current?.click() })} className={btn}>
          {uploading ? "Uploading…" : "🖼️ Image"}
        </button>
        <button type="button" title="Clear formatting" onMouseDown={hold(() => exec("removeFormat"))} className={`${btn} text-gray-400`}>Clear</button>

        <input ref={fileRef} type="file" accept="image/*" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) onImagePicked(f); e.target.value = "" }} />
      </div>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        onInput={emit}
        onKeyUp={saveSelection}
        onMouseUp={saveSelection}
        onBlur={saveSelection}
        onClick={(e) => {
          const t = e.target as HTMLElement
          selectedImg.current = t.tagName === "IMG" ? (t as HTMLImageElement) : null
        }}
        className="min-h-[140px] px-3 py-2 text-sm text-gray-800 focus:outline-none [&_a]:text-blue-600 [&_a]:underline [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_h2]:text-lg [&_h2]:font-bold [&_h3]:text-base [&_h3]:font-semibold [&_img]:max-w-full [&_img]:rounded [&_img]:my-2"
      />
    </div>
  )
}

// Renders sanitized rich content (read-only). Inline styles (color, highlight,
// alignment), images, and lists are preserved by the sanitizer.
export function RichTextView({ html, className = "" }: { html: string; className?: string }) {
  return (
    <div
      className={`text-sm text-gray-700 [&_a]:text-blue-600 [&_a]:underline [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_h2]:text-lg [&_h2]:font-bold [&_h3]:text-base [&_h3]:font-semibold [&_img]:max-w-full [&_img]:rounded [&_img]:my-2 ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
