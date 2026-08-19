"use client"
// components/ui/RichTextEditor.tsx — the WYSIWYG editor used by notes, page
// content and the firm's rich composer.
import { useRef, useEffect, useState } from "react"
import { PromptDialog } from "@/components/ui/PromptDialog"

// Which URL the dialog is currently asking for; null when it's closed.
type UrlAsk = "link" | "image"

// Full WYSIWYG editor: formatting, alignment, color, highlight, font size,
// indent, lists, headings, links, inline image upload + resize/position.
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
  const [uploading, setUploading] = useState(false)
  const [imgEl, setImgEl] = useState<HTMLImageElement | null>(null)
  const [imgWidth, setImgWidth] = useState(100)
  const [urlAsk, setUrlAsk] = useState<UrlAsk | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)

  // Sync external value changes (initial load + "Copy from global") into the
  // editor, but never while the user is typing in it (avoids caret jumps).
  useEffect(() => {
    const el = ref.current
    if (el && document.activeElement !== el && el.innerHTML !== (value || "")) {
      el.innerHTML = value || ""
    }
  }, [value])

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

  function align(dir: "left" | "center" | "right" | "justify") {
    if (imgEl && ref.current?.contains(imgEl)) {
      imgEl.style.float = "none"
      imgEl.style.marginLeft = ""
      imgEl.style.marginRight = ""
      if (dir === "center") { imgEl.style.display = "block"; imgEl.style.marginLeft = "auto"; imgEl.style.marginRight = "auto" }
      else if (dir === "left") { imgEl.style.display = "inline"; imgEl.style.float = "left"; imgEl.style.marginRight = "1rem" }
      else if (dir === "right") { imgEl.style.display = "inline"; imgEl.style.float = "right"; imgEl.style.marginLeft = "1rem" }
      else { imgEl.style.display = "" }
      emit()
      return
    }
    exec(dir === "center" ? "justifyCenter" : dir === "right" ? "justifyRight" : dir === "left" ? "justifyLeft" : "justifyFull")
  }

  function resizeImg(pct: number) {
    if (!imgEl || !ref.current?.contains(imgEl)) return
    imgEl.style.width = `${pct}%`
    imgEl.style.height = "auto"
    setImgWidth(pct)
    emit()
  }

  function normalizeUrl(u: string) {
    const t = u.trim()
    if (!t) return t
    if (/^(https?:\/\/|mailto:|tel:)/i.test(t)) return t
    return `https://${t}`
  }

  // The selection is saved before the dialog opens and put back when it closes,
  // so the link lands on the words that were highlighted.
  function submitUrl(raw: string) {
    const ask = urlAsk
    setUrlAsk(null)
    if (!ask) return
    restoreSelection()
    exec(ask === "link" ? "createLink" : "insertImage", normalizeUrl(raw))
  }

  async function onImagePicked(file: File) {
    setUploading(true)
    setUploadError(null)
    try {
      const fd = new FormData()
      fd.append("file", file)
      const res = await fetch("/api/admin/content-image", { method: "POST", body: fd }).catch(() => null)
      if (!res?.ok) { setUploadError("That image didn't upload — images only, up to 10 MB."); return }
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

        <button type="button" title="Add link" onMouseDown={hold(() => { saveSelection(); setUrlAsk("link") })} className={btn}>🔗 Link</button>
        <button type="button" title="Remove link" onMouseDown={hold(() => exec("unlink"))} className={btn}>⛌</button>
        <button type="button" title="Upload image" onMouseDown={hold(() => { saveSelection(); fileRef.current?.click() })} className={btn}>
          {uploading ? "Uploading…" : "🖼️ Upload"}
        </button>
        <button type="button" title="Insert image by link/URL" onMouseDown={hold(() => { saveSelection(); setUrlAsk("image") })} className={btn}>🔗 Image</button>
        <button type="button" title="Clear formatting" onMouseDown={hold(() => exec("removeFormat"))} className={`${btn} text-gray-400`}>Clear</button>

        <input ref={fileRef} type="file" accept="image/*" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) onImagePicked(f); e.target.value = "" }} />
      </div>

      {uploadError && (
        <div className="flex items-center gap-2 border-b border-red-200 bg-red-50 px-3 py-1.5">
          <p className="text-xs text-red-700 flex-1">{uploadError}</p>
          <button type="button" onMouseDown={hold(() => setUploadError(null))} aria-label="Dismiss" className="text-red-500 hover:text-red-800 text-xs">✕</button>
        </div>
      )}

      {/* Image controls — appear when an image is selected */}
      {imgEl && (
        <div className="flex items-center gap-3 flex-wrap border-b border-gray-200 bg-blue-50 px-3 py-1.5 text-xs text-gray-700">
          <span className="font-medium">Image:</span>
          <span>Size</span>
          <input type="range" min={10} max={100} value={imgWidth}
            onChange={(e) => resizeImg(parseInt(e.target.value))} className="w-32" />
          <span className="w-8 tabular-nums">{imgWidth}%</span>
          <button type="button" onMouseDown={hold(() => resizeImg(25))} className="px-2 py-0.5 rounded hover:bg-blue-100">25%</button>
          <button type="button" onMouseDown={hold(() => resizeImg(50))} className="px-2 py-0.5 rounded hover:bg-blue-100">50%</button>
          <button type="button" onMouseDown={hold(() => resizeImg(100))} className="px-2 py-0.5 rounded hover:bg-blue-100">Full</button>
          <span className="text-gray-400">— use the align buttons above to center/float it</span>
        </div>
      )}

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
          if (t.tagName === "IMG") {
            const im = t as HTMLImageElement
            setImgEl(im)
            const w = parseInt(im.style.width)
            setImgWidth(im.style.width.endsWith("%") && w ? w : 100)
          } else {
            setImgEl(null)
          }
        }}
        className="min-h-[140px] px-3 py-2 text-sm text-gray-800 focus:outline-none [&_a]:text-blue-600 [&_a]:underline [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_h2]:text-lg [&_h2]:font-bold [&_h3]:text-base [&_h3]:font-semibold [&_img]:max-w-full [&_img]:rounded [&_img]:my-2"
      />

      <PromptDialog
        open={urlAsk !== null}
        title={urlAsk === "image" ? "Insert an image by link" : "Add a link"}
        body={
          urlAsk === "image"
            ? "Paste the web address of the image you want to show here."
            : "Paste or type the web address the highlighted text should open."
        }
        label={urlAsk === "image" ? "Image address" : "Link address"}
        placeholder={urlAsk === "image" ? "https://…" : "tinyurl.com/eflupload"}
        confirmLabel={urlAsk === "image" ? "Insert image" : "Add link"}
        onSubmit={submitUrl}
        onCancel={() => setUrlAsk(null)}
      />
    </div>
  )
}

// RichTextView (the read-only renderer) lives in
// components/ui/RichTextView.tsx so read-only pages don't pull in this editor.
