"use client"
// components/admin/tasks/bits.tsx - the small shared pieces of the Tasks
// screen: badges, status pills and icon buttons. Kept together so the tabs stay
// readable. The confirm dialog, inline error and undo banner now live in
// components/ui/ (the whole portal uses them) and are re-exported here so the
// Tasks tabs can keep importing them from "./bits".
import { useEffect, useRef } from "react"
import { STATE_CLASS, STATE_LABEL, type TaskState } from "@/lib/task-progress"

export { ConfirmDialog } from "@/components/ui/ConfirmDialog"
export { InlineError } from "@/components/ui/InlineError"
export { UndoBanner } from "@/components/ui/UndoBanner"

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

// Replaces the bare 📝 - says what it means instead of leaving it to memory.
export function NotesBadge() {
  return (
    <span
      title="This task has instructions saved on it - open it to read or edit them"
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
