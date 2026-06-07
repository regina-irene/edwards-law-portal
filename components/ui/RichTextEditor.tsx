"use client"

import { useRef, useEffect } from "react"

// Full WYSIWYG editor (formatting, alignment, color, highlight, lists, links).
export function RichTextEditor({
  value,
  onChange,
}: {
  value: string
  onChange: (html: string) => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const savedRange = useRef<Range | null>(null)

  // Set initial content once on mount (avoids caret jumps on re-render).
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
    if (savedRange.current && sel) {
      ref.current?.focus()
      sel.removeAllRanges()
      sel.addRange(savedRange.current)
    } else {
      ref.current?.focus()
    }
  }

  function exec(cmd: string, arg?: string) {
    try { document.execCommand("styleWithCSS", false, "true") } catch {}
    document.execCommand(cmd, false, arg)
    emit()
  }

  // Used by color inputs, which steal focus/selection when opened.
  function execWithRestore(cmd: string, arg: string) {
    restoreSelection()
    try { document.execCommand("styleWithCSS", false, "true") } catch {}
    document.execCommand(cmd, false, arg)
    emit()
  }

  function addLink() {
    saveSelection()
    const url = window.prompt("Link URL (https://...)")
    if (url) { restoreSelection(); exec("createLink", url.trim()) }
  }

  const btn = "px-2 py-1 text-sm rounded hover:bg-gray-200 text-gray-700"
  const Divider = () => <span className="w-px h-5 bg-gray-300 mx-1" />
  // Keep editor selection when clicking a toolbar button
  const hold = (fn: () => void) => (e: React.MouseEvent) => { e.preventDefault(); fn() }

  return (
    <div className="border border-gray-300 rounded-lg overflow-hidden">
      <div className="flex items-center gap-0.5 flex-wrap border-b border-gray-200 bg-gray-50 px-2 py-1">
        <button type="button" title="Bold" onMouseDown={hold(() => exec("bold"))} className={`${btn} font-bold`}>B</button>
        <button type="button" title="Italic" onMouseDown={hold(() => exec("italic"))} className={`${btn} italic`}>I</button>
        <button type="button" title="Underline" onMouseDown={hold(() => exec("underline"))} className={`${btn} underline`}>U</button>
        <button type="button" title="Strikethrough" onMouseDown={hold(() => exec("strikeThrough"))} className={`${btn} line-through`}>S</button>
        <Divider />

        {/* Text color */}
        <label title="Text color" className="flex items-center gap-1 px-1 cursor-pointer" onMouseDown={saveSelection}>
          <span className="text-sm font-bold text-gray-700">A</span>
          <input type="color" defaultValue="#111827" className="w-5 h-5 p-0 border-0 bg-transparent cursor-pointer"
            onChange={(e) => execWithRestore("foreColor", e.target.value)} />
        </label>
        {/* Highlight */}
        <label title="Highlight" className="flex items-center gap-1 px-1 cursor-pointer" onMouseDown={saveSelection}>
          <span className="text-sm text-gray-700">🖍️</span>
          <input type="color" defaultValue="#fef08a" className="w-5 h-5 p-0 border-0 bg-transparent cursor-pointer"
            onChange={(e) => execWithRestore("hiliteColor", e.target.value)} />
        </label>
        <Divider />

        <button type="button" title="Align left" onMouseDown={hold(() => exec("justifyLeft"))} className={btn}>⫷</button>
        <button type="button" title="Align center" onMouseDown={hold(() => exec("justifyCenter"))} className={btn}>☰</button>
        <button type="button" title="Align right" onMouseDown={hold(() => exec("justifyRight"))} className={btn}>⫸</button>
        <button type="button" title="Justify" onMouseDown={hold(() => exec("justifyFull"))} className={btn}>▤</button>
        <Divider />

        <button type="button" title="Bulleted list" onMouseDown={hold(() => exec("insertUnorderedList"))} className={btn}>• List</button>
        <button type="button" title="Numbered list" onMouseDown={hold(() => exec("insertOrderedList"))} className={btn}>1. List</button>
        <Divider />

        <select
          title="Text style"
          defaultValue=""
          onMouseDown={saveSelection}
          onChange={(e) => { execWithRestore("formatBlock", e.target.value); e.target.value = "" }}
          className="text-sm rounded px-1 py-1 bg-transparent hover:bg-gray-200 text-gray-700"
        >
          <option value="" disabled>Style</option>
          <option value="H2">Heading</option>
          <option value="H3">Subheading</option>
          <option value="P">Normal</option>
        </select>
        <Divider />

        <button type="button" title="Add link" onMouseDown={hold(addLink)} className={btn}>🔗 Link</button>
        <button type="button" title="Remove link" onMouseDown={hold(() => exec("unlink"))} className={btn}>⛌</button>
        <button type="button" title="Clear formatting" onMouseDown={hold(() => exec("removeFormat"))} className={`${btn} text-gray-400`}>Clear</button>
      </div>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        onInput={emit}
        onKeyUp={saveSelection}
        onMouseUp={saveSelection}
        onBlur={saveSelection}
        className="min-h-[140px] px-3 py-2 text-sm text-gray-800 focus:outline-none [&_a]:text-blue-600 [&_a]:underline [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_h2]:text-lg [&_h2]:font-bold [&_h3]:text-base [&_h3]:font-semibold"
      />
    </div>
  )
}

// Renders sanitized rich content (read-only). Inline styles (color, highlight,
// alignment) are preserved by the sanitizer so it looks the same as the editor.
export function RichTextView({ html, className = "" }: { html: string; className?: string }) {
  return (
    <div
      className={`text-sm text-gray-700 [&_a]:text-blue-600 [&_a]:underline [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_h2]:text-lg [&_h2]:font-bold [&_h3]:text-base [&_h3]:font-semibold ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
