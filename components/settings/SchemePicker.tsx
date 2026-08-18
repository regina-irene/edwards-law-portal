"use client"
// components/settings/SchemePicker.tsx — the scheme swatch grid + gradient
// toggle (2026-08-18). Shared by the client Settings page and the admin
// Appearance section so both sides offer exactly the same looks.
// Schemes are grouped Everyday / Seasonal, and whatever is in season today
// gets a badge plus a one-click suggestion — never applied automatically.

import { useEffect, useState } from "react"
import {
  SCHEMES,
  EVERYDAY_KEYS,
  SEASONAL_KEYS,
  applyGradient,
  isInSeason,
  getSeasonalSuggestions,
  type ColorScheme,
} from "@/lib/color-schemes"

function SchemeSwatch({
  scheme,
  gradient,
  selected,
  inSeason,
  onSelect,
}: {
  scheme: ColorScheme
  gradient: boolean
  selected: boolean
  inSeason: boolean
  onSelect: () => void
}) {
  const s = applyGradient(scheme, gradient)
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`relative text-left rounded-xl border-2 overflow-hidden transition-shadow ${
        selected ? "border-gray-800 shadow-md" : "border-gray-200 hover:border-gray-400"
      }`}
    >
      {inSeason && (
        <span className="absolute top-1.5 right-1.5 z-10 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-semibold text-gray-700 border border-gray-200">
          In season
        </span>
      )}
      <div className="flex h-16" style={{ background: s.pageBg }}>
        <div className="w-6 shrink-0" style={{ background: s.sidebarBg }} />
        <div className="flex-1 p-2">
          <div className="h-2 w-16 rounded" style={{ background: s.accent }} />
          <div className="mt-1.5 h-6 rounded bg-white border border-gray-200 flex items-center px-1.5">
            {s.titleEmoji && <span className="text-xs">{s.titleEmoji}</span>}
          </div>
        </div>
      </div>
      <div className="px-3 py-2 bg-white">
        <p className="text-sm font-semibold text-gray-900">
          {s.name}
          {selected ? " ✓" : ""}
        </p>
        <p className="text-xs text-gray-500">{s.blurb}</p>
      </div>
    </button>
  )
}

function Group({
  label,
  keys,
  scheme,
  gradient,
  today,
  onSchemeChange,
}: {
  label: string
  keys: string[]
  scheme: string
  gradient: boolean
  today: Date | null
  onSchemeChange: (key: string) => void
}) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide font-semibold text-gray-400 mb-2">{label}</p>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {keys.map((key) => (
          <SchemeSwatch
            key={key}
            scheme={SCHEMES[key]}
            gradient={gradient}
            selected={scheme === key}
            inSeason={today ? isInSeason(SCHEMES[key], today) : false}
            onSelect={() => onSchemeChange(key)}
          />
        ))}
      </div>
    </div>
  )
}

export default function SchemePicker({
  scheme,
  gradient,
  onSchemeChange,
  onGradientChange,
}: {
  scheme: string
  gradient: boolean
  onSchemeChange: (key: string) => void
  onGradientChange: (on: boolean) => void
}) {
  // Resolved after mount so the server and client markup can't disagree about
  // what day it is (which would otherwise be a hydration mismatch).
  const [today, setToday] = useState<Date | null>(null)
  useEffect(() => setToday(new Date()), [])

  const suggestions = today ? getSeasonalSuggestions(today).filter((s) => s.key !== scheme) : []

  return (
    <div className="space-y-5">
      <label className="flex items-start gap-3 cursor-pointer select-none rounded-lg border border-gray-200 p-3">
        <input
          type="checkbox"
          checked={gradient}
          onChange={(e) => onGradientChange(e.target.checked)}
          className="mt-0.5 h-5 w-5 rounded border-gray-300"
        />
        <span>
          <span className="text-sm text-gray-800 font-medium block">Gradient background</span>
          <span className="text-xs text-gray-500">
            Fades the page and sidebar through the scheme&apos;s colors instead of one flat tone. The
            swatches below update as you toggle it.
          </span>
        </span>
      </label>

      {suggestions.length > 0 && (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
          <p className="text-sm text-gray-800">
            {suggestions.length === 1 ? "This look is in season right now:" : "These looks are in season right now:"}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {suggestions.map((s) => (
              <button
                key={s.key}
                type="button"
                onClick={() => onSchemeChange(s.key)}
                className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-800 hover:border-gray-500"
              >
                {s.titleEmoji} Try {s.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <Group label="Everyday" keys={EVERYDAY_KEYS} scheme={scheme} gradient={gradient} today={today} onSchemeChange={onSchemeChange} />
      <Group label="Seasonal" keys={SEASONAL_KEYS} scheme={scheme} gradient={gradient} today={today} onSchemeChange={onSchemeChange} />
    </div>
  )
}
