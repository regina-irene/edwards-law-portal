"use client"
// components/settings/SettingsClient.tsx — theme picker (10 swatches) + joke
// of the day toggle. Saves to /api/settings, then refreshes so the new
// background applies immediately.

import { useState } from "react"
import { useRouter } from "next/navigation"
import { THEMES } from "@/lib/themes"

export default function SettingsClient({ initialTheme, initialShowJoke }: { initialTheme: string; initialShowJoke: boolean }) {
  const router = useRouter()
  const [theme, setTheme] = useState(initialTheme)
  const [showJoke, setShowJoke] = useState(initialShowJoke)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  async function save() {
    setSaving(true)
    setSaved(false)
    const res = await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ theme, showJoke }),
    })
    setSaving(false)
    if (res.ok) {
      setSaved(true)
      router.refresh()
    }
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-xs uppercase tracking-wide font-semibold mb-1" style={{ color: "#1b2d45" }}>Background</h2>
        <p className="text-sm text-gray-500 mb-4">Pick the look of your portal. Dark options switch to light text.</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
          {THEMES.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTheme(t.key)}
              className={`rounded-xl border-2 overflow-hidden text-left transition-all ${theme === t.key ? "ring-2 ring-offset-2 ring-blue-500 border-blue-500" : "border-gray-200 hover:border-gray-400"}`}
            >
              <div className="h-14 w-full flex items-end px-2 pb-1" style={{ background: t.bg }}>
                <span className="text-[10px] font-semibold" style={{ color: t.ink }}>Aa</span>
              </div>
              <div className="px-2 py-1.5 bg-white">
                <p className="text-xs font-medium text-gray-800">{t.label}</p>
                {theme === t.key && <p className="text-[10px] text-blue-600 font-semibold">Selected ✓</p>}
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-xs uppercase tracking-wide font-semibold mb-1" style={{ color: "#1b2d45" }}>Joke of the Day</h2>
        <p className="text-sm text-gray-500 mb-4">A clean, family-friendly joke at the top of your portal. A fresh one appears every 4 hours.</p>
        <label className="flex items-center gap-3 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={showJoke}
            onChange={(e) => setShowJoke(e.target.checked)}
            className="h-5 w-5 rounded border-gray-300"
          />
          <span className="text-sm text-gray-800 font-medium">Show me a silly joke 😄</span>
        </label>
      </div>

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
