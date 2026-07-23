"use client"
// components/settings/SettingsClient.tsx — color scheme picker + joke-of-the-day
// toggle. (Schemes returned 2026-07-23 as 8 curated looks; the old wallpaper
// theme picker stays gone.)

import { useState } from "react"
import { useRouter } from "next/navigation"
import { SCHEMES, SCHEME_KEYS, type ColorScheme } from "@/lib/color-schemes"

function Section({ title, blurb, children }: { title: string; blurb: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <h2 className="text-xs uppercase tracking-wide font-semibold mb-1" style={{ color: "var(--scheme-heading, #1b2d45)" }}>{title}</h2>
      <p className="text-sm text-gray-500 mb-4">{blurb}</p>
      {children}
    </div>
  )
}

function SchemeSwatch({ scheme, selected, onSelect }: { scheme: ColorScheme; selected: boolean; onSelect: () => void }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`text-left rounded-xl border-2 overflow-hidden transition-shadow ${
        selected ? "border-gray-800 shadow-md" : "border-gray-200 hover:border-gray-400"
      }`}
    >
      <div className="flex h-16" style={{ background: scheme.pageBg }}>
        <div className="w-6 shrink-0" style={{ background: scheme.sidebarBg }} />
        <div className="flex-1 p-2">
          <div className="h-2 w-16 rounded" style={{ background: scheme.accent }} />
          <div className="mt-1.5 h-6 rounded bg-white border border-gray-200 flex items-center px-1.5">
            {scheme.titleEmoji && <span className="text-xs">{scheme.titleEmoji}</span>}
          </div>
        </div>
      </div>
      <div className="px-3 py-2 bg-white">
        <p className="text-sm font-semibold text-gray-900">{scheme.name}{selected ? " ✓" : ""}</p>
        <p className="text-xs text-gray-500">{scheme.blurb}</p>
      </div>
    </button>
  )
}

export default function SettingsClient({ initialShowJoke, initialScheme }: { initialShowJoke: boolean; initialScheme: string }) {
  const router = useRouter()
  const [showJoke, setShowJoke] = useState(initialShowJoke)
  const [scheme, setScheme] = useState(initialScheme)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  async function save() {
    setSaving(true)
    setSaved(false)
    const res = await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ showJoke, scheme }),
    })
    setSaving(false)
    if (res.ok) {
      setSaved(true)
      router.refresh()
    }
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <Section title="Color Scheme" blurb="Pick the look of YOUR portal. Every scheme keeps things easy to read — seasonal ones add a little extra fun.">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {SCHEME_KEYS.map((key) => (
            <SchemeSwatch key={key} scheme={SCHEMES[key]} selected={scheme === key} onSelect={() => setScheme(key)} />
          ))}
        </div>
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

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="px-6 py-2.5 rounded-lg text-white text-sm font-semibold hover:opacity-90 disabled:opacity-60 transition-opacity"
          style={{ background: "var(--scheme-accent, #1b2d45)" }}
        >
          {saving ? "Saving…" : "Save settings"}
        </button>
        {saved && <span className="text-sm text-green-700 font-medium">Saved! ✓</span>}
      </div>
    </div>
  )
}
