"use client"
// components/ui/UndoBanner.tsx — a banner that reports what just happened and
// offers an undo for a while, then gets out of the way.
import { useEffect, useState } from "react"

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
