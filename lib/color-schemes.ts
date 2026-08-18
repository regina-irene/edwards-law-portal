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
    pageBgGradient: "linear-gradient(160deg,#FFFDF9 0%,#FBF8F3 45%,#EFE4D2 100%)",
    sidebarBgGradient: "linear-gradient(180deg,#F8F2E8 0%,#E9DDC9 100%)",
  },
  sage: {
    key: "sage", name: "Sage & Forest", blurb: "Calm greens, natural and steady.",
    seasonal: false,
    pageBg: "#EEF2EA", sidebarBg: "#2E4636", sidebarLogoBg: "#ffffff",
    navInk: "#dde7dc", navHoverBg: "rgba(255,255,255,.14)", navActiveBg: "rgba(255,255,255,.22)", navActiveInk: "#ffffff",
    accent: "#2E4636", heading: "#2E4636", metaBorder: "#d8e0d4",
    stripe: null, watermark: [], titleEmoji: null,
    pageBgGradient: "linear-gradient(160deg,#F7FBF5 0%,#EEF2EA 50%,#DBE7D8 100%)",
    sidebarBgGradient: "linear-gradient(180deg,#2E4636 0%,#4A6A52 100%)",
  },
  burgundy: {
    key: "burgundy", name: "Burgundy & Blush", blurb: "Warm and elegant.",
    seasonal: false,
    pageBg: "#F7EEEC", sidebarBg: "#5C2233", sidebarLogoBg: "#ffffff",
    navInk: "#eddade", navHoverBg: "rgba(255,255,255,.14)", navActiveBg: "rgba(255,255,255,.22)", navActiveInk: "#ffffff",
    accent: "#5C2233", heading: "#5C2233", metaBorder: "#e6d4d0",
    stripe: null, watermark: [], titleEmoji: null,
    pageBgGradient: "linear-gradient(160deg,#FFF7F3 0%,#F7EEEC 45%,#F0D8D2 100%)",
    sidebarBgGradient: "linear-gradient(180deg,#5C2233 0%,#8E3B44 100%)",
  },
  slate: {
    key: "slate", name: "Slate & Mist", blurb: "Cool, crisp and modern.",
    seasonal: false,
    pageBg: "#EEF1F4", sidebarBg: "#33414E", sidebarLogoBg: "#ffffff",
    navInk: "#dbe2e8", navHoverBg: "rgba(255,255,255,.14)", navActiveBg: "rgba(255,255,255,.22)", navActiveInk: "#ffffff",
    accent: "#33414E", heading: "#33414E", metaBorder: "#d7dde3",
    stripe: null, watermark: [], titleEmoji: null,
    pageBgGradient: "linear-gradient(160deg,#F8FBFD 0%,#EEF1F4 50%,#DBE3EB 100%)",
    sidebarBgGradient: "linear-gradient(180deg,#33414E 0%,#52687C 100%)",
  },
  plum: {
    key: "plum", name: "Plum & Lavender", blurb: "Gentle and distinctive.",
    seasonal: false,
    pageBg: "#F2EEF6", sidebarBg: "#46325A", sidebarLogoBg: "#ffffff",
    navInk: "#e4dcee", navHoverBg: "rgba(255,255,255,.14)", navActiveBg: "rgba(255,255,255,.22)", navActiveInk: "#ffffff",
    accent: "#46325A", heading: "#46325A", metaBorder: "#ded4e8",
    stripe: null, watermark: [], titleEmoji: null,
    pageBgGradient: "linear-gradient(160deg,#FBF7FF 0%,#F2EEF6 50%,#E2D6F0 100%)",
    sidebarBgGradient: "linear-gradient(180deg,#46325A 0%,#6E5488 100%)",
  },
  halloween: {
    key: "halloween", name: "Autumn Twilight", blurb: "Pumpkins, candlelight and a friendly bat. 🎃",
    seasonal: true,
    pageBg: "#F5E6CE", sidebarBg: "linear-gradient(180deg,#2B2138,#3A2A1A)", sidebarLogoBg: "#ffffff",
    navInk: "#f0e4d0", navHoverBg: "rgba(255,255,255,.14)", navActiveBg: "rgba(255,255,255,.22)", navActiveInk: "#ffffff",
    accent: "#B4551D", heading: "#8A3D14", metaBorder: "#e0c9a8",
    stripe: "linear-gradient(90deg,#B4551D,#2B2138,#B4551D)",
    watermark: ["🎃", "🦇", "🍂", "🕸️", "🎃", "🍁"], titleEmoji: "🎃",
    pageBgGradient: "linear-gradient(160deg,#FDF2DE 0%,#F5E6CE 50%,#E7C79C 100%)",
    sidebarBgGradient: "linear-gradient(180deg,#2B2138 0%,#5A3A22 55%,#8A4A18 100%)",
  },
  winter: {
    key: "winter", name: "Winter Frost", blurb: "Snow, frost and sparkle — happy holidays. ❄️",
    seasonal: true,
    pageBg: "#E3EDF6", sidebarBg: "linear-gradient(180deg,#16324F,#2A5078)", sidebarLogoBg: "#ffffff",
    navInk: "#dcebf8", navHoverBg: "rgba(255,255,255,.16)", navActiveBg: "rgba(255,255,255,.24)", navActiveInk: "#ffffff",
    accent: "#2A5078", heading: "#16324F", metaBorder: "#c8daea",
    stripe: "linear-gradient(90deg,#7FB2E5,#16324F,#7FB2E5)",
    watermark: ["❄️", "⛄", "❄️", "🌨️", "❄️", "✨"], titleEmoji: "❄️",
    pageBgGradient: "linear-gradient(160deg,#F4FAFF 0%,#E3EDF6 50%,#C6DCF0 100%)",
    sidebarBgGradient: "linear-gradient(180deg,#16324F 0%,#2A5078 55%,#4276A6 100%)",
  },
  football: {
    key: "football", name: "Game Day", blurb: "Turf, yard lines and touchdowns — team-neutral. 🏈",
    seasonal: true,
    pageBg: "#E4EEDD", sidebarBg: "linear-gradient(180deg,#1E3B24,#2E5636)", sidebarLogoBg: "#ffffff",
    navInk: "#dfeeda", navHoverBg: "rgba(255,255,255,.14)", navActiveBg: "rgba(255,255,255,.22)", navActiveInk: "#ffffff",
    accent: "#5C3A1E", heading: "#1E3B24", metaBorder: "#c9dcbf",
    stripe: "repeating-linear-gradient(90deg,#ffffff 0 8px,#2E5636 8px 24px)",
    watermark: ["🏈", "🏆", "🏈", "📣", "🏈", "⭐"], titleEmoji: "🏈",
    pageBgGradient: "linear-gradient(160deg,#F2F9EC 0%,#E4EEDD 50%,#CCE0BF 100%)",
    sidebarBgGradient: "linear-gradient(180deg,#1E3B24 0%,#2E5636 55%,#437347 100%)",
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
