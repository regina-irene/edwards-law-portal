"use client"
// components/ui/PromptDialog.tsx — asks for one line of text in the portal's
// own dialog, so nothing has to use the browser's prompt box (which announces
// itself with the site's address and looks like a scam).
import { useEffect, useRef, useState } from "react"

export function PromptDialog({
  open,
  title,
  body,
  label,
  placeholder,
  initialValue = "",
  confirmLabel = "Save",
  onSubmit,
  onCancel,
}: {
  open: boolean
  title: string
  body?: string
  label: string
  placeholder?: string
  initialValue?: string
  confirmLabel?: string
  onSubmit: (value: string) => void
  onCancel: () => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [value, setValue] = useState<string>(initialValue)

  useEffect(() => {
    if (!open) return
    setValue(initialValue)
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [open, initialValue])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onCancel() }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, onCancel])

  if (!open) return null

  const submit = () => {
    const trimmed = value.trim()
    if (!trimmed) return
    onSubmit(trimmed)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(15,23,42,0.35)" }} role="dialog" aria-modal="true" aria-label={title}>
      <div className="bg-white rounded-2xl border border-gray-200 shadow-lg max-w-md w-full p-5">
        <h3 className="serif text-lg font-semibold text-gray-900">{title}</h3>
        {body && <p className="text-sm text-gray-600 mt-1.5">{body}</p>}
        <label className="block text-xs font-semibold text-gray-500 mt-4 mb-1">{label}</label>
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); submit() }
          }}
          placeholder={placeholder}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="px-3.5 py-2 rounded-lg text-sm font-semibold border border-gray-300 text-gray-700 hover:bg-gray-50">
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!value.trim()}
            className="px-3.5 py-2 rounded-lg text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
