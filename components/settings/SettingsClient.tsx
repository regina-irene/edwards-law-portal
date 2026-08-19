"use client"
// components/settings/SettingsClient.tsx — color scheme picker + joke-of-the-day
// toggle. (Schemes returned 2026-07-23 as 8 curated looks; the old wallpaper
// theme picker stays gone. Gradient mode added 2026-08-18.)

import { useState } from "react"
import { useRouter } from "next/navigation"
import SchemePicker from "@/components/settings/SchemePicker"

function Section({ title, blurb, children }: { title: string; blurb: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <h2 className="text-xs uppercase tracking-wide font-semibold mb-1" style={{ color: "var(--scheme-heading, #1b2d45)" }}>{title}</h2>
      <p className="text-sm text-gray-500 mb-4">{blurb}</p>
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
    <div className="space-y-6 max-w-3xl">
      <Section title="Color Scheme" blurb="Pick the look of YOUR portal. Every scheme keeps things easy to read — turn on the gradient for a softer fade, and seasonal ones add a little extra fun.">
        <SchemePicker
          scheme={scheme}
          gradient={gradient}
          onSchemeChange={setScheme}
          onGradientChange={setGradient}
        />
      </Section>

      <Section title="Joke of the Day" blurb="A clean, family-friendly joke at the top of your portal. A fresh one appears every 4 hours.">
        <label className="flex items-center gap-3 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={showJoke}
            onChange={(e) => setShowJoke(e.target.checked)}
            className="h-5 w-5 rounded border-gray-300"
          />
          <span className="text-sm text-gray-800 font-medium">Show me a silly joke 😄</span>
        </label>
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
