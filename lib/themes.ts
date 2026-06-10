// lib/themes.ts — the 10 portal background themes clients can pick on the
// Settings page. `dark` themes flip the page text to light.

export interface PortalTheme {
  key: string
  label: string
  bg: string
  ink: string
  dark: boolean
}

export const THEMES: PortalTheme[] = [
  { key: "classic", label: "Classic Cream", bg: "#FBF8F3", ink: "#262220", dark: false },
  { key: "ocean", label: "Ocean Blue", bg: "linear-gradient(170deg, #eaf7fa 0%, #c8e8f0 35%, #9fd3e3 70%, #76b9d3 100%)", ink: "#0c2d3f", dark: false },
  { key: "sunrise", label: "Sunrise", bg: "linear-gradient(170deg, #fff7ed 0%, #ffedd5 50%, #fed7aa 100%)", ink: "#431407", dark: false },
  { key: "lavender", label: "Lavender", bg: "linear-gradient(170deg, #faf5ff 0%, #ede9fe 50%, #ddd6fe 100%)", ink: "#2e1065", dark: false },
  { key: "sage", label: "Sage Garden", bg: "linear-gradient(170deg, #f0fdf4 0%, #dcfce7 55%, #bbf7d0 100%)", ink: "#052e16", dark: false },
  { key: "blush", label: "Blush", bg: "linear-gradient(170deg, #fff1f2 0%, #ffe4e6 55%, #fecdd3 100%)", ink: "#4c0519", dark: false },
  { key: "sky", label: "Clear Sky", bg: "linear-gradient(170deg, #eff6ff 0%, #dbeafe 55%, #bfdbfe 100%)", ink: "#172554", dark: false },
  { key: "midnight", label: "Midnight Navy", bg: "linear-gradient(170deg, #0f1b2d 0%, #16263d 60%, #1d3050 100%)", ink: "#e8eef7", dark: true },
  { key: "charcoal", label: "Charcoal", bg: "#1d1f23", ink: "#ececec", dark: true },
  { key: "royal", label: "Royal Purple", bg: "linear-gradient(170deg, #1e1b4b 0%, #312e81 55%, #4c1d95 100%)", ink: "#ece9fe", dark: true },
]

export function getTheme(key: string | null | undefined): PortalTheme {
  return THEMES.find((t) => t.key === key) ?? THEMES[0]
}
