"use client"
// components/ui/ConfirmDialog.tsx — a confirm step that names what's about to
// happen and puts the focus on the button, so nothing anywhere in the portal
// has to fall back to the browser's own grey confirm box.
import { useEffect, useRef } from "react"

export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel = "Delete",
  onConfirm,
  onCancel,
}: {
  open: boolean
  title: string
  body: string
  confirmLabel?: string
  onConfirm: () => void
  onCancel: () => void
}) {
  const confirmRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (open) confirmRef.current?.focus()
  }, [open])
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onCancel() }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, onCancel])

  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(15,23,42,0.35)" }} role="dialog" aria-modal="true" aria-label={title}>
      <div className="bg-white rounded-2xl border border-gray-200 shadow-lg max-w-md w-full p-5">
        <h3 className="serif text-lg font-semibold text-gray-900">{title}</h3>
        <p className="text-sm text-gray-600 mt-1.5">{body}</p>
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="px-3.5 py-2 rounded-lg text-sm font-semibold border border-gray-300 text-gray-700 hover:bg-gray-50">
            Cancel
          </button>
          <button ref={confirmRef} type="button" onClick={onConfirm} className="px-3.5 py-2 rounded-lg text-sm font-semibold text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500">
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
