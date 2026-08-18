"use client"
// components/settings/SchemePicker.tsx — the scheme swatch grid + gradient
// toggle (2026-08-18). Shared by the client Settings page and the admin
// Appearance section so both sides offer exactly the same looks.

import { SCHEMES, SCHEME_KEYS, applyGradient, type ColorScheme } from "@/lib/color-schemes"

function SchemeSwatch({
  scheme,
  gradient,
  selected,
  onSelect,
}: {
  scheme: ColorScheme
  gradient: boolean
  selected: boolean
  onSelect: () => void
}) {
  const s = applyGradient(scheme, gradient)
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`text-left rounded-xl border-2 overflow-hidden transition-shadow ${
        selected ? "border-gray-800 shadow-md" : "border-gray-200 hover:border-gray-400"
      }`}
    >
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
  return (
    <div className="space-y-4">
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

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {SCHEME_KEYS.map((key) => (
          <SchemeSwatch
            key={key}
            scheme={SCHEMES[key]}
            gradient={gradient}
            selected={scheme === key}
            onSelect={() => onSchemeChange(key)}
          />
        ))}
      </div>
    </div>
  )
}
