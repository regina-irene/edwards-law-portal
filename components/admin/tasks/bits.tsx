"use client"
// components/admin/tasks/bits.tsx — the small shared pieces of the Tasks
// screen: badges, status pills, icon buttons and the confirm dialog. Kept
// together so the tabs stay readable.
import { useEffect, useRef, useState } from "react"
import { STATE_CLASS, STATE_LABEL, type TaskState } from "@/lib/task-progress"

export function StatusPill({ state }: { state: TaskState }) {
  return (
    <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold whitespace-nowrap ${STATE_CLASS[state]}`}>
      {STATE_LABEL[state]}
    </span>
  )
}

const TAG_STYLES: Record<string, string> = {
  Form: "bg-blue-50 text-blue-700 border-blue-200",
  Signature: "bg-purple-50 text-purple-700 border-purple-200",
}

export function TagBadge({ tag }: { tag: string }) {
  const style = TAG_STYLES[tag] ?? "bg-gray-50 text-gray-600 border-gray-200"
  return (
    <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold border whitespace-nowrap ${style}`}>
      {tag}
    </span>
  )
}

// Replaces the bare 📝 — says what it means instead of leaving it to memory.
export function NotesBadge() {
  return (
    <span
      title="This task has instructions saved on it — open it to read or edit them"
      className="text-[11px] px-2 py-0.5 rounded-full font-semibold border bg-amber-50 text-amber-700 border-amber-200 whitespace-nowrap"
    >
      Has notes
    </span>
  )
}

// 32px hit target, label for screen readers, colour only on hover so a long
// list isn't a wall of coloured text.
export function IconButton({
  label,
  onClick,
  children,
  danger = false,
  active = false,
}: {
  label: string
  onClick: () => void
  children: React.ReactNode
  danger?: boolean
  active?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`w-8 h-8 inline-flex items-center justify-center rounded-lg border text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${
        danger
          ? "border-transparent text-gray-400 hover:text-red-600 hover:border-red-200 hover:bg-red-50"
          : active
            ? "border-blue-200 bg-blue-50 text-blue-700"
            : "border-transparent text-gray-500 hover:text-gray-900 hover:border-gray-200 hover:bg-gray-50"
      }`}
    >
      {children}
    </button>
  )
}

// A confirm step that names what's being deleted, replacing window.confirm.
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

// Inline error with a retry, used wherever a save can fail.
export function InlineError({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <p className="text-xs text-red-600 mt-1">
      {message}
      {onRetry && (
        <button type="button" onClick={onRetry} className="ml-2 underline hover:text-red-800">Try again</button>
      )}
    </p>
  )
}

export function SkeletonRows({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-2" aria-hidden="true">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-10 rounded-lg bg-gray-100 animate-pulse" />
      ))}
    </div>
  )
}

// Checkbox that can also render the indeterminate (partial) state, which HTML
// only exposes through the DOM property.
export function TriStateCheckbox({
  checked,
  indeterminate,
  onChange,
  label,
}: {
  checked: boolean
  indeterminate: boolean
  onChange: () => void
  label: string
}) {
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate && !checked
  }, [indeterminate, checked])
  return (
    <input
      ref={ref}
      type="checkbox"
      checked={checked}
      onChange={onChange}
      aria-label={label}
      className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
    />
  )
}

// A banner that reports what just happened and offers an undo for a while.
export function UndoBanner({
  message,
  seconds = 10,
  onUndo,
  onDismiss,
}: {
  message: string
  seconds?: number
  onUndo: () => void
  onDismiss: () => void
}) {
  // The caller gives this a key per message, so a fresh banner remounts with a
  // fresh countdown and the effect only has to own the interval.
  const [left, setLeft] = useState(seconds)
  useEffect(() => {
    const t = setInterval(() => {
      setLeft((n) => {
        if (n <= 1) { clearInterval(t); onDismiss(); return 0 }
        return n - 1
      })
    }, 1000)
    return () => clearInterval(t)
  }, [onDismiss])

  return (
    <div className="flex items-center gap-3 rounded-xl border border-green-200 bg-green-50 px-4 py-2.5">
      <span className="text-sm text-green-900 font-medium">✅ {message}</span>
      <button type="button" onClick={onUndo} className="text-sm font-semibold text-green-900 underline hover:text-green-700">
        Undo ({left}s)
      </button>
      <button type="button" onClick={onDismiss} aria-label="Dismiss" className="ml-auto text-green-700 hover:text-green-900">✕</button>
    </div>
  )
}
