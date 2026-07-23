# Client Color Schemes — Design

**Date:** 2026-07-23
**Approved by:** Regina (via visual companion mockups — all 8 schemes approved)

## What we're building

A "Color scheme" section on the client Settings page (`/settings`). Clients pick one of
8 curated schemes; the choice recolors THEIR portal (background tint + accents). This
partially reverses the 2026-07-17 Thistle facelift decision ("one navy/cream look") at
Regina's explicit request — but unlike the old theme system (deleted lib/themes.ts,
team wallpapers), every scheme keeps the refined Thistle style: light background,
dark ink, one deep accent, text always on solid white cards. No wallpapers, no dark
themes, no light-text machinery (`theme-dark` CSS stays dead).

## The 8 schemes

Core five (background tint + accent):

| Key | Name | Page bg | Accent (sidebar/buttons/headings) |
|---|---|---|---|
| `navy` (default) | Navy & Cream | `#F5EEE3` | `#1b2d45` (current look, unchanged) |
| `sage` | Sage & Forest | `#EEF2EA` | `#2E4636` |
| `burgundy` | Burgundy & Blush | `#F7EEEC` | `#5C2233` |
| `slate` | Slate & Mist | `#EEF1F4` | `#33414E` |
| `plum` | Plum & Lavender | `#F2EEF6` | `#46325A` |

Seasonal three ("v2 festive" mockups approved — Regina rejected the subtle v1). Each
adds: a festive gradient stripe under the top strip, ~6 faint floating seasonal emoji
over the page background (opacity ≈ .15–.2, pointer-events none, print:hidden), an
emoji at the sidebar's base, and an emoji prefix on page titles:

| Key | Name | Page bg | Sidebar | Buttons | Headings | Icons |
|---|---|---|---|---|---|---|
| `halloween` | Autumn Twilight 🎃 | `#F5E6CE` | gradient `#2B2138→#3A2A1A` | `#B4551D` | `#8A3D14` | 🎃🦇🍂🕸️🍁 |
| `winter` | Winter Frost ❄️ | `#E3EDF6` | gradient `#16324F→#2A5078` | `#2A5078` | `#16324F` | ❄️⛄🌨️✨ |
| `football` | Game Day 🏈 | `#E4EEDD` | gradient `#1E3B24→#2E5636` | `#5C3A1E` | `#1E3B24` | 🏈🏆📣⭐ (yard-line stripe: white/green) |

Winter Frost is deliberately non-denominational (snow/frost only). Game Day is
team-neutral. All seasonal schemes are available in the picker YEAR-ROUND (Regina
didn't opt for in-season-only; simplest default, easy to gate by month later).

## Architecture

- **`lib/color-schemes.ts`** (new): `SCHEMES` record — one entry per key with name,
  description, bg, accent, sidebarBg (solid or CSS gradient), headingColor, stripe CSS,
  watermark emoji list, titleEmoji. `getScheme(key)` falls back to `navy` for unknown
  keys (old DB values like 'classic', 'nfl-falcons' resolve to the default).
- **Storage:** reuse the existing `client_prefs.theme` column (currently written as
  'classic', never read). `ClientPrefs` gains `scheme: string`. No migration needed.
- **`app/(client)/layout.tsx`:** looks up the scheme, sets page bg + CSS custom
  properties (`--scheme-accent`, `--scheme-heading`, `--scheme-sidebar`) on the
  wrapper, renders the festive stripe + floating emoji layer for seasonal schemes,
  passes scheme to Sidebar. Admin layout untouched — admin stays navy/white.
  Admin "preview as client" shows that client's scheme automatically (same layout path).
- **Recolored components (scoped, not a full tokenization):** Sidebar background,
  PageTitle/heading color, primary buttons in shared components — switch hardcoded
  `#1b2d45` to `var(--scheme-accent, #1b2d45)` where they live under the client
  layout. Stray hexes elsewhere are the facelift Part-3 sweep, NOT this project.
- **Settings UI (`components/settings/SettingsClient.tsx`):** new "Color scheme"
  section above the joke toggle — 8 clickable swatch cards (mini preview: sidebar
  bar + bg + accent dot + name), selected ring, saved via the existing Save button.
- **API (`/api/settings` PUT):** accepts `{ showJoke, scheme }`; validates scheme
  against `SCHEMES` keys (invalid → 400).
- **Watermark interplay:** the firm-logo corner Motif stays on all schemes; seasonal
  emoji layer renders beneath content (z-index under `relative z-10` main).

## Error handling / edge cases

- Unknown/legacy `theme` values in DB → default navy (no crashes, no cleanup needed).
- `client_prefs` row missing → navy + joke off (current behavior).
- Print: seasonal decorations `print:hidden`.
- Readability: all schemes keep dark ink on light bg; nothing touches `.keep-ink`
  or the manila case-file card; status page inputs unaffected.

## Testing

- Unit test `getScheme` fallback + `/api/settings` scheme validation.
- Manual: pick each scheme in admin preview, check Settings page, dashboard,
  messages, status (manila card must stay manila), print view.

## Out of scope

- In-season-only gating of seasonal schemes (future toggle).
- Full hex tokenization sweep (facelift Part 3).
- Admin-side scheme choice; per-page schemes; dark mode.
