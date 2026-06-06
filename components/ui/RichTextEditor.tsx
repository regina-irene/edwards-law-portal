"use client"

import { useRef, useEffect } from "react"

// Lightweight WYSIWYG editor (bold/italic/underline/list/link) producing HTML.
export function RichTextEditor({
  value,
  onChange,
}: {
  value: string
  onChange: (html: string) => void
}) {
  const ref = useRef<HTMLDivElement>(null)

  // Set initial content once on mount (avoids caret jumps on re-render).
  useEffect(() => {
    if (ref.current) ref.current.innerHTML = value || ""
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function exec(cmd: string, arg?: string) {
    document.execCommand(cmd, false, arg)
    if (ref.current) onChange(ref.current.innerHTML)
  }

  function addLink() {
    const url = window.prompt("Link URL (https://...)")
    if (url) exec("createLink", url.trim())
  }

  const btn = "px-2 py-1 text-sm rounded hover:bg-gray-200"

  return (
    <div className="border border-gray-300 rounded-lg overflow-hidden">
      <div className="flex items-center gap-0.5 border-b border-gray-200 bg-gray-50 px-2 py-1">
        <button type="button" onMouseDown={(e) => { e.preventDefault(); exec("bold") }} className={`${btn} font-bold`}>B</button>
        <button type="button" onMouseDown={(e) => { e.preventDefault(); exec("italic") }} className={`${btn} italic`}>I</button>
        <button type="button" onMouseDown={(e) => { e.preventDefault(); exec("underline") }} className={`${btn} underline`}>U</button>
        <span className="w-px h-4 bg-gray-300 mx-1" />
        <button type="button" onMouseDown={(e) => { e.preventDefault(); exec("insertUnorderedList") }} className={btn}>• List</button>
        <button type="button" onMouseDown={(e) => { e.preventDefault(); addLink() }} className={btn}>🔗 Link</button>
        <button type="button" onMouseDown={(e) => { e.preventDefault(); exec("removeFormat") }} className={`${btn} text-gray-400`}>Clear</button>
      </div>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        onInput={() => ref.current && onChange(ref.current.innerHTML)}
        className="min-h-[120px] px-3 py-2 text-sm text-gray-800 focus:outline-none [&_a]:text-blue-600 [&_a]:underline [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5"
      />
    </div>
  )
}

// Renders sanitized notes HTML (read-only).
export function RichTextView({ html, className = "" }: { html: string; className?: string }) {
  return (
    <div
      className={`text-sm text-gray-700 [&_a]:text-blue-600 [&_a]:underline [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
