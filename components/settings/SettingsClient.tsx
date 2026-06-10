"use client"
// components/settings/SettingsClient.tsx — theme picker (base looks, holidays,
// sports incl. NFL/MLB team colors) + joke of the day toggle. Everything is
// selected right on this page; saving applies the background immediately.

import { useState } from "react"
import { useRouter } from "next/navigation"
import { BASE_THEMES, GRADIENT_THEMES, NFL_THEMES, MLB_THEMES, getTheme, type PortalTheme } from "@/lib/themes"

function Swatch({ t, selected, onSelect }: { t: PortalTheme; selected: boolean; onSelect: () => void }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`rounded-xl border-2 overflow-hidden text-left transition-all ${selected ? "ring-2 ring-offset-2 ring-blue-500 border-blue-500" : "border-gray-200 hover:border-gray-400"}`}
    >
      <div className="h-14 w-full flex items-end px-2 pb-1" style={{ background: t.bg }}>
        <span className="text-[10px] font-semibold" style={{ color: t.ink }}>Aa</span>
      </div>
      <div className="px-2 py-1.5 bg-white">
        <p className="text-xs font-medium text-gray-800">{t.label}</p>
        {selected && <p className="text-[10px] text-blue-600 font-semibold">Selected ✓</p>}
      </div>
    </button>
  )
}

function Section({ title, blurb, children }: { title: string; blurb: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <h2 className="text-xs uppercase tracking-wide font-semibold mb-1" style={{ color: "#1b2d45" }}>{title}</h2>
      <p className="text-sm text-gray-500 mb-4">{blurb}</p>
      {children}
    </div>
  )
}

interface SettingsClientProps {
  initialTheme: string
  initialShowJoke: boolean
  initialLightText: boolean
}

export default function SettingsClient({ initialTheme, initialShowJoke, initialLightText }: SettingsClientProps) {
  const router = useRouter()
  const [theme, setTheme] = useState(initialTheme)
  const [showJoke, setShowJoke] = useState(initialShowJoke)
  const [lightText, setLightText] = useState(initialLightText)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const selectedTheme = getTheme(theme)
  const nflPick = theme.startsWith("nfl-") ? theme : ""
  const mlbPick = theme.startsWith("mlb-") ? theme : ""

  async function save() {
    setSaving(true)
    setSaved(false)
    const res = await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ theme, showJoke, lightText }),
    })
    setSaving(false)
    if (res.ok) {
      setSaved(true)
      router.refresh()
    }
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <Section title="Background" blurb="Pick the look of your portal. Dark options switch to light text.">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
          {BASE_THEMES.map((t) => <Swatch key={t.key} t={t} selected={theme === t.key} onSelect={() => setTheme(t.key)} />)}
        </div>
      </Section>

      <Section title="Bold Gradients" blurb="Stronger color-to-color blends for a more vivid portal.">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
          {GRADIENT_THEMES.map((t) => <Swatch key={t.key} t={t} selected={theme === t.key} onSelect={() => setTheme(t.key)} />)}
        </div>
      </Section>

      <Section title="Text" blurb="Dark backgrounds switch to light text automatically — turn this on to always use light text.">
        <label className="flex items-center gap-3 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={lightText}
            onChange={(e) => setLightText(e.target.checked)}
            className="h-5 w-5 rounded border-gray-300"
          />
          <span className="text-sm text-gray-800 font-medium">Always use light text</span>
        </label>
      </Section>

      <Section title="Sports" blurb="Pick your favorite NFL or MLB team for a team-logo wallpaper in team colors.">
        <div className="grid sm:grid-cols-2 gap-4">
          <label className="block">
            <span className="text-xs uppercase tracking-wide text-gray-500 font-semibold">🏈 NFL team</span>
            <select
              value={nflPick}
              onChange={(e) => e.target.value && setTheme(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white text-gray-900"
            >
              <option value="">Choose a team…</option>
              {NFL_THEMES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="text-xs uppercase tracking-wide text-gray-500 font-semibold">⚾ MLB team</span>
            <select
              value={mlbPick}
              onChange={(e) => e.target.value && setTheme(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white text-gray-900"
            >
              <option value="">Choose a team…</option>
              {MLB_THEMES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
            </select>
          </label>
        </div>
        {(nflPick || mlbPick) && (
          <div className="mt-4 rounded-xl overflow-hidden border border-gray-200">
            <div className="h-16 flex items-center justify-center" style={{ background: selectedTheme.bg }}>
              <span className="text-sm font-bold" style={{ color: selectedTheme.ink }}>{selectedTheme.label} — Selected ✓</span>
            </div>
          </div>
        )}
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
          style={{ background: "#1b2d45" }}
        >
          {saving ? "Saving…" : "Save settings"}
        </button>
        {saved && <span className="text-sm text-green-700 font-medium">Saved! ✓</span>}
      </div>
    </div>
  )
}
