"use client"
// components/settings/SettingsClient.tsx — color scheme picker + joke-of-the-day
// toggle. (Schemes returned 2026-07-23 as 8 curated looks; the old wallpaper
// theme picker stays gone. Gradient mode added 2026-08-18.)

import { useState } from "react"
import { useRouter } from "next/navigation"
import SchemePicker from "@/components/settings/SchemePicker"

// Tightened 2026-08-18: the page was three tall cards with a lot of air. The
// heading and its blurb now share a line where they fit, and the padding is
// closer to the rest of the portal.
function Section({ title, blurb, children }: { title: string; blurb: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 px-4 py-3.5">
      <div className="flex items-baseline gap-x-3 gap-y-0.5 flex-wrap mb-3">
        <h2 className="text-xs uppercase tracking-wide font-semibold shrink-0" style={{ color: "var(--scheme-heading, #1b2d45)" }}>{title}</h2>
        <p className="text-xs text-gray-500">{blurb}</p>
      </div>
      {children}
    </div>
  )
}

export default function SettingsClient({
  initialShowJoke,
  initialScheme,
  initialGradient,
  readOnly = false,
}: {
  initialShowJoke: boolean
  initialScheme: string
  initialGradient: boolean
  // True while the client's case is closed: they can look around, but the
  // portal stays exactly as they left it.
  readOnly?: boolean
}) {
  const router = useRouter()
  const [showJoke, setShowJoke] = useState(initialShowJoke)
  const [scheme, setScheme] = useState(initialScheme)
  const [gradient, setGradient] = useState(initialGradient)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  async function save() {
    if (readOnly) return
    setSaving(true)
    setSaved(false)
    const res = await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ showJoke, scheme, gradient }),
    })
    setSaving(false)
    if (res.ok) {
      setSaved(true)
      router.refresh()
    }
  }

  return (
    <div className="space-y-3 max-w-3xl">
      {/* Joke first: it's the one-click setting, so it shouldn't sit below the
          swatch grid where it needs a scroll to reach. */}
      <div className="bg-white rounded-xl border border-gray-200 px-4 py-3">
        <label className="flex items-center gap-3 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={showJoke}
            onChange={(e) => setShowJoke(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 shrink-0"
          />
          <span className="text-sm text-gray-800 font-medium shrink-0">Joke of the day 😄</span>
          <span className="text-xs text-gray-500">A clean, family-friendly joke at the top of your portal, refreshed every few hours.</span>
        </label>
      </div>

      <Section title="Color Scheme" blurb="Pick the look of YOUR portal — gradient for a softer fade, seasonal ones for a little fun.">
        <SchemePicker
          scheme={scheme}
          gradient={gradient}
          onSchemeChange={setScheme}
          onGradientChange={setGradient}
        />
      </Section>

      <div className="flex items-center gap-3 flex-wrap">
        <button
          type="button"
          onClick={save}
          disabled={saving || readOnly}
          className="px-6 py-2.5 rounded-lg text-white text-sm font-semibold hover:opacity-90 disabled:opacity-60 transition-opacity"
          style={{ background: "var(--scheme-accent, #1b2d45)" }}
        >
          {saving ? "Saving…" : "Save settings"}
        </button>
        {readOnly && (
          <span className="text-sm text-gray-600">
            Your case is closed, so your settings stay as they are.
          </span>
        )}
        {saved && <span className="text-sm text-green-700 font-medium">Saved! ✓</span>}
      </div>
    </div>
  )
}
