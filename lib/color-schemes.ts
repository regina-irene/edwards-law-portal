// lib/color-schemes.ts — the 8 curated client color schemes (2026-07-23,
// approved by Regina via mockups). Every scheme keeps the Thistle style:
// light background, dark ink, one deep accent, text on solid white cards.
// The default `navy` MUST equal today's hardcoded portal colors exactly —
// the client layout sets these as CSS vars and components fall back to the
// same values, which is also what keeps the admin layout unchanged.

export interface ColorScheme {
  key: string
  name: string
  blurb: string
  seasonal: boolean
  pageBg: string        // page background (behind cards)
  sidebarBg: string     // solid color or CSS gradient
  sidebarLogoBg: string // chip behind the logo so it reads on dark sidebars
  navInk: string        // inactive nav item text
  navHoverBg: string    // inactive nav item hover background
  navActiveBg: string   // active nav item background
  navActiveInk: string  // active nav item text
  accent: string        // primary buttons
  heading: string       // page-title/heading color
  metaBorder: string    // meta-strip border color
  stripe: string | null // festive stripe CSS background (seasonal only)
  watermark: string[]   // floating background emojis (seasonal only)
  titleEmoji: string | null // rendered before page titles (seasonal only)
  // Gradient mode (2026-08-18): opt-in softer version of the same scheme.
  // Toggling gradient on swaps pageBg/sidebarBg for these; nothing else
  // about the scheme changes, so contrast and readability are unaffected.
  pageBgGradient: string
  sidebarBgGradient: string
}

export const DEFAULT_SCHEME_KEY = "navy"

export const SCHEMES: Record<string, ColorScheme> = {
  navy: {
    key: "navy", name: "Navy & Cream", blurb: "The classic Edwards Family Law look.",
    seasonal: false,
    pageBg: "#FBF8F3", sidebarBg: "#F5EEE3", sidebarLogoBg: "transparent",
    navInk: "#33404c", navHoverBg: "#efe7da", navActiveBg: "#1B2D45", navActiveInk: "#ffffff",
    accent: "#1B2D45", heading: "#111827", metaBorder: "#E8DFD2",
    stripe: null, watermark: [], titleEmoji: null,
    pageBgGradient: "linear-gradient(160deg,#FFFDF9 0%,#F6EFE2 45%,#E3D3B9 100%)",
    sidebarBgGradient: "linear-gradient(180deg,#F8F1E4 0%,#DECEB4 100%)",
  },
  sage: {
    key: "sage", name: "Sage & Forest", blurb: "Calm greens, natural and steady.",
    seasonal: false,
    pageBg: "#EEF2EA", sidebarBg: "#2E4636", sidebarLogoBg: "#ffffff",
    navInk: "#dde7dc", navHoverBg: "rgba(255,255,255,.14)", navActiveBg: "rgba(255,255,255,.22)", navActiveInk: "#ffffff",
    accent: "#2E4636", heading: "#2E4636", metaBorder: "#d8e0d4",
    stripe: null, watermark: [], titleEmoji: null,
    pageBgGradient: "linear-gradient(160deg,#F7FBF5 0%,#E6EEE2 50%,#C7DCC2 100%)",
    sidebarBgGradient: "linear-gradient(180deg,#22352A 0%,#5A8064 100%)",
  },
  burgundy: {
    key: "burgundy", name: "Burgundy & Blush", blurb: "Warm and elegant.",
    seasonal: false,
    pageBg: "#F7EEEC", sidebarBg: "#5C2233", sidebarLogoBg: "#ffffff",
    navInk: "#eddade", navHoverBg: "rgba(255,255,255,.14)", navActiveBg: "rgba(255,255,255,.22)", navActiveInk: "#ffffff",
    accent: "#5C2233", heading: "#5C2233", metaBorder: "#e6d4d0",
    stripe: null, watermark: [], titleEmoji: null,
    pageBgGradient: "linear-gradient(160deg,#FFF7F3 0%,#F6E4DF 45%,#E6BDB4 100%)",
    sidebarBgGradient: "linear-gradient(180deg,#4A1626 0%,#A34A54 100%)",
  },
  slate: {
    key: "slate", name: "Slate & Mist", blurb: "Cool, crisp and modern.",
    seasonal: false,
    pageBg: "#EEF1F4", sidebarBg: "#33414E", sidebarLogoBg: "#ffffff",
    navInk: "#dbe2e8", navHoverBg: "rgba(255,255,255,.14)", navActiveBg: "rgba(255,255,255,.22)", navActiveInk: "#ffffff",
    accent: "#33414E", heading: "#33414E", metaBorder: "#d7dde3",
    stripe: null, watermark: [], titleEmoji: null,
    pageBgGradient: "linear-gradient(160deg,#F8FBFD 0%,#E7ECF1 50%,#C7D4E0 100%)",
    sidebarBgGradient: "linear-gradient(180deg,#25313C 0%,#63798D 100%)",
  },
  plum: {
    key: "plum", name: "Plum & Lavender", blurb: "Gentle and distinctive.",
    seasonal: false,
    pageBg: "#F2EEF6", sidebarBg: "#46325A", sidebarLogoBg: "#ffffff",
    navInk: "#e4dcee", navHoverBg: "rgba(255,255,255,.14)", navActiveBg: "rgba(255,255,255,.22)", navActiveInk: "#ffffff",
    accent: "#46325A", heading: "#46325A", metaBorder: "#ded4e8",
    stripe: null, watermark: [], titleEmoji: null,
    pageBgGradient: "linear-gradient(160deg,#FBF7FF 0%,#EDE5F5 50%,#D3C0E8 100%)",
    sidebarBgGradient: "linear-gradient(180deg,#37264A 0%,#7F639B 100%)",
  },
  halloween: {
    key: "halloween", name: "Autumn Twilight", blurb: "Pumpkins, candlelight and a friendly bat. 🎃",
    seasonal: true,
    pageBg: "#F5E6CE", sidebarBg: "linear-gradient(180deg,#2B2138,#3A2A1A)", sidebarLogoBg: "#ffffff",
    navInk: "#f0e4d0", navHoverBg: "rgba(255,255,255,.14)", navActiveBg: "rgba(255,255,255,.22)", navActiveInk: "#ffffff",
    accent: "#B4551D", heading: "#8A3D14", metaBorder: "#e0c9a8",
    stripe: "linear-gradient(90deg,#B4551D,#2B2138,#B4551D)",
    watermark: ["🎃", "🦇", "🍂", "🕸️", "🎃", "🍁"], titleEmoji: "🎃",
    pageBgGradient: "linear-gradient(160deg,#FDF2DE 0%,#F2DCB8 50%,#DDB47F 100%)",
    sidebarBgGradient: "linear-gradient(180deg,#241B30 0%,#63401F 55%,#A85512 100%)",
  },
  winter: {
    key: "winter", name: "Winter Frost", blurb: "Snow, frost and sparkle — happy holidays. ❄️",
    seasonal: true,
    pageBg: "#E3EDF6", sidebarBg: "linear-gradient(180deg,#16324F,#2A5078)", sidebarLogoBg: "#ffffff",
    navInk: "#dcebf8", navHoverBg: "rgba(255,255,255,.16)", navActiveBg: "rgba(255,255,255,.24)", navActiveInk: "#ffffff",
    accent: "#2A5078", heading: "#16324F", metaBorder: "#c8daea",
    stripe: "linear-gradient(90deg,#7FB2E5,#16324F,#7FB2E5)",
    watermark: ["❄️", "⛄", "❄️", "🌨️", "❄️", "✨"], titleEmoji: "❄️",
    pageBgGradient: "linear-gradient(160deg,#F4FAFF 0%,#DCE9F5 50%,#B3D0E9 100%)",
    sidebarBgGradient: "linear-gradient(180deg,#0F2740 0%,#2A5078 55%,#4E85B8 100%)",
  },
  football: {
    key: "football", name: "Game Day", blurb: "Turf, yard lines and touchdowns — team-neutral. 🏈",
    seasonal: true,
    pageBg: "#E4EEDD", sidebarBg: "linear-gradient(180deg,#1E3B24,#2E5636)", sidebarLogoBg: "#ffffff",
    navInk: "#dfeeda", navHoverBg: "rgba(255,255,255,.14)", navActiveBg: "rgba(255,255,255,.22)", navActiveInk: "#ffffff",
    accent: "#5C3A1E", heading: "#1E3B24", metaBorder: "#c9dcbf",
    stripe: "repeating-linear-gradient(90deg,#ffffff 0 8px,#2E5636 8px 24px)",
    watermark: ["🏈", "🏆", "🏈", "📣", "🏈", "⭐"], titleEmoji: "🏈",
    pageBgGradient: "linear-gradient(160deg,#F2F9EC 0%,#DDE9D3 50%,#BCD5AB 100%)",
    sidebarBgGradient: "linear-gradient(180deg,#152B1A 0%,#2E5636 55%,#4C8452 100%)",
  },
  // Pastel + sunset additions (2026-08-18) — requested alongside gradient mode.
  blush: {
    key: "blush", name: "Blush & Rose", blurb: "Soft pastel pink, warm and welcoming.",
    seasonal: false,
    pageBg: "#FBF0F3", sidebarBg: "#7A3D52", sidebarLogoBg: "#ffffff",
    navInk: "#f2dde4", navHoverBg: "rgba(255,255,255,.14)", navActiveBg: "rgba(255,255,255,.22)", navActiveInk: "#ffffff",
    accent: "#7A3D52", heading: "#7A3D52", metaBorder: "#ecd7dd",
    stripe: null, watermark: [], titleEmoji: null,
    pageBgGradient: "linear-gradient(160deg,#FFF7F9 0%,#F8E6EC 50%,#EFC8D6 100%)",
    sidebarBgGradient: "linear-gradient(180deg,#5E2C3D 0%,#A85F7A 100%)",
  },
  seafoam: {
    key: "seafoam", name: "Seafoam & Teal", blurb: "Cool pastel water, quiet and clean.",
    seasonal: false,
    pageBg: "#E9F4F2", sidebarBg: "#1F4E4A", sidebarLogoBg: "#ffffff",
    navInk: "#d6ebe8", navHoverBg: "rgba(255,255,255,.14)", navActiveBg: "rgba(255,255,255,.22)", navActiveInk: "#ffffff",
    accent: "#1F4E4A", heading: "#1F4E4A", metaBorder: "#cfe3e0",
    stripe: null, watermark: [], titleEmoji: null,
    pageBgGradient: "linear-gradient(160deg,#F3FBF9 0%,#E0F0ED 50%,#BEDFD9 100%)",
    sidebarBgGradient: "linear-gradient(180deg,#153B38 0%,#3A7D75 100%)",
  },
  sunset: {
    key: "sunset", name: "Sunset & Amber", blurb: "Warm amber fading into coral.",
    seasonal: false,
    pageBg: "#FDF0E6", sidebarBg: "#7A3A1E", sidebarLogoBg: "#ffffff",
    navInk: "#f6dfcd", navHoverBg: "rgba(255,255,255,.14)", navActiveBg: "rgba(255,255,255,.22)", navActiveInk: "#ffffff",
    accent: "#A8501F", heading: "#7A3A1E", metaBorder: "#f0dac6",
    stripe: null, watermark: [], titleEmoji: null,
    pageBgGradient: "linear-gradient(160deg,#FFF8F0 0%,#FBE7D4 50%,#F4C8A3 100%)",
    sidebarBgGradient: "linear-gradient(180deg,#6B2F17 0%,#B0602E 100%)",
  },
}

export const SCHEME_KEYS = Object.keys(SCHEMES)

export function getScheme(key: string | null | undefined): ColorScheme {
  return (key && SCHEMES[key]) || SCHEMES[DEFAULT_SCHEME_KEY]
}

/** Gradient mode swaps only the two background surfaces; ink, accent and
 *  decorations are untouched, so every scheme stays as readable as it was. */
export function applyGradient(scheme: ColorScheme, gradient: boolean | null | undefined): ColorScheme {
  if (!gradient) return scheme
  return { ...scheme, pageBg: scheme.pageBgGradient, sidebarBg: scheme.sidebarBgGradient }
}

/** Look up a scheme by key and apply gradient mode in one step. */
export function resolveScheme(key: string | null | undefined, gradient: boolean | null | undefined): ColorScheme {
  return applyGradient(getScheme(key), gradient)
}

/** True when the sidebar is dark enough to need light ink. The logo chip is
 *  the tell: it only exists so the logo reads against a dark sidebar. */
export function isDarkSidebar(scheme: ColorScheme): boolean {
  return scheme.sidebarLogoBg !== "transparent"
}
