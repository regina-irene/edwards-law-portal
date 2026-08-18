# Color Schemes & Holiday Backgrounds — Portable Reference

Every color, gradient, stripe, emoji set and season window used by the Edwards
Family Law client portal, written so it can be dropped into any other app.
Nothing here is Next.js specific. The live source of truth is
`lib/color-schemes.ts`; this file mirrors it as of 2026-08-18.

19 schemes: 8 everyday, 11 seasonal. Each one also has a gradient variant.

---

## The design contract

Every scheme, including the loudest holiday one, follows the same rules. Keep
these if you port the palette, or the schemes stop being safe to use:

1. **Light page, dark ink.** The page background is always pale. Body text is
   always dark.
2. **Content sits on solid white cards.** The scheme colors the surroundings,
   never the reading surface. This is what keeps holiday themes legible.
3. **One deep accent** per scheme, used for primary buttons and the active nav
   item. Never for body text.
4. **Decoration is background-only.** Emojis and stripes sit under the content
   at low opacity and are `pointer-events: none`.
5. **Gradient mode swaps only two surfaces** — page background and sidebar.
   Ink, accent, borders and decoration are untouched, so contrast never changes.
6. **Nothing is ever applied automatically.** Seasonal schemes are suggested,
   never forced.

---

## Token reference

| Token | Meaning |
|---|---|
| `pageBg` | Page background, behind the cards |
| `sidebarBg` | Sidebar fill — a solid color or a CSS gradient |
| `sidebarLogoBg` | Chip behind the logo so it reads on dark sidebars. `transparent` means the sidebar is light |
| `navInk` | Inactive nav item text |
| `navHoverBg` | Inactive nav item hover background |
| `navActiveBg` | Active nav item background |
| `navActiveInk` | Active nav item text |
| `accent` | Primary buttons |
| `heading` | Page titles and headings |
| `metaBorder` | Hairline border under the top meta strip |
| `stripe` | Festive bar across the top. Seasonal only, `null` otherwise |
| `watermark[]` | Background emojis. Seasonal only |
| `titleEmoji` | Rendered before page titles. Seasonal only |
| `pageBgGradient` | Page background when gradient mode is on |
| `sidebarBgGradient` | Sidebar when gradient mode is on |
| `season` | Date window when this look is suggested |
| `seasonNote` | Caption on the suggestion (used to mark the non-religious option) |

`isDarkSidebar` is derived, not stored: a scheme has a dark sidebar whenever
`sidebarLogoBg !== "transparent"`. Only Navy & Cream is light.

---

## Everyday schemes

| Key | Name | pageBg | sidebarBg | accent | heading | metaBorder | navInk |
|---|---|---|---|---|---|---|---|
| `navy` | Navy & Cream | `#FBF8F3` | `#F5EEE3` | `#1B2D45` | `#111827` | `#E8DFD2` | `#33404c` |
| `sage` | Sage & Forest | `#EEF2EA` | `#2E4636` | `#2E4636` | `#2E4636` | `#d8e0d4` | `#dde7dc` |
| `burgundy` | Burgundy & Blush | `#F7EEEC` | `#5C2233` | `#5C2233` | `#5C2233` | `#e6d4d0` | `#eddade` |
| `slate` | Slate & Mist | `#EEF1F4` | `#33414E` | `#33414E` | `#33414E` | `#d7dde3` | `#dbe2e8` |
| `plum` | Plum & Lavender | `#F2EEF6` | `#46325A` | `#46325A` | `#46325A` | `#ded4e8` | `#e4dcee` |
| `blush` | Blush & Rose | `#FBF0F3` | `#7A3D52` | `#7A3D52` | `#7A3D52` | `#ecd7dd` | `#f2dde4` |
| `seafoam` | Seafoam & Teal | `#E9F4F2` | `#1F4E4A` | `#1F4E4A` | `#1F4E4A` | `#cfe3e0` | `#d6ebe8` |
| `sunset` | Sunset & Amber | `#FDF0E6` | `#7A3A1E` | `#A8501F` | `#7A3A1E` | `#f0dac6` | `#f6dfcd` |

Navy is the default and the only light-sidebar scheme. It uses
`navHoverBg: #efe7da`, `navActiveBg: #1B2D45`, `navActiveInk: #ffffff`.

Every other everyday scheme uses the same dark-sidebar nav values:

```
navHoverBg:   rgba(255,255,255,.14)
navActiveBg:  rgba(255,255,255,.22)
navActiveInk: #ffffff
sidebarLogoBg: #ffffff
```

---

## Seasonal schemes

| Key | Name | pageBg | sidebarBg | accent | heading | metaBorder |
|---|---|---|---|---|---|---|
| `winter` | Winter Frost | `#E3EDF6` | `linear-gradient(180deg,#16324F,#2A5078)` | `#2A5078` | `#16324F` | `#c8daea` |
| `valentines` | Sweetheart | `#FBEFF3` | `linear-gradient(180deg,#7A1F3D,#A83A5B)` | `#A83A5B` | `#7A1F3D` | `#f0d5de` |
| `stpatricks` | Lucky Clover | `#EDF6EC` | `linear-gradient(180deg,#0F4C2A,#1B6B3A)` | `#147A3D` | `#0F4C2A` | `#d3e6d1` |
| `spring` | Spring Bloom | `#F4F8EE` | `linear-gradient(180deg,#4A7C59,#7BA05B)` | `#5B8C5A` | `#3F6B4B` | `#dfeacf` |
| `july4` | Stars & Stripes | `#F2F5FA` | `linear-gradient(180deg,#0A2463,#16357F)` | `#B22234` | `#0A2463` | `#d5dcea` |
| `football` | Game Day | `#E4EEDD` | `linear-gradient(180deg,#1E3B24,#2E5636)` | `#5C3A1E` | `#1E3B24` | `#c9dcbf` |
| `halloween` | Autumn Twilight | `#F5E6CE` | `linear-gradient(180deg,#2B2138,#3A2A1A)` | `#B4551D` | `#8A3D14` | `#e0c9a8` |
| `thanksgiving` | Harvest Table | `#F8EFE0` | `linear-gradient(180deg,#5A2A1E,#7C4426)` | `#8C3B25` | `#5A2A1E` | `#e8d7bf` |
| `christmas` | Christmas | `#F2F6EF` | `linear-gradient(180deg,#123524,#1E4D32)` | `#9B2226` | `#123524` | `#d8e3d5` |
| `hanukkah` | Hanukkah | `#EDF3FA` | `linear-gradient(180deg,#0F2E5C,#1B4A8A)` | `#1B4A8A` | `#0F2E5C` | `#d4e0ee` |
| `newyear` | Midnight Confetti | `#F3F1EC` | `linear-gradient(180deg,#14141A,#2A2A35)` | `#B8912F` | `#14141A` | `#ddd8cc` |

Nav ink per seasonal scheme:

| Key | navInk | navHoverBg / navActiveBg |
|---|---|---|
| `winter` | `#dcebf8` | `.16` / `.24` white |
| `valentines` | `#f6dde5` | `.14` / `.22` white |
| `stpatricks` | `#d9eddc` | `.14` / `.22` white |
| `spring` | `#eaf4e4` | `.16` / `.24` white |
| `july4` | `#dde5f5` | `.14` / `.22` white |
| `football` | `#dfeeda` | `.14` / `.22` white |
| `halloween` | `#f0e4d0` | `.14` / `.22` white |
| `thanksgiving` | `#f3e2cf` | `.14` / `.22` white |
| `christmas` | `#dcecdf` | `.14` / `.22` white |
| `hanukkah` | `#d9e7f7` | `.16` / `.24` white |
| `newyear` | `#e6e2d6` | `.14` / `.22` white |

All seasonal schemes use `sidebarLogoBg: #ffffff` and `navActiveInk: #ffffff`.

---

## Gradient variants

Gradient mode replaces `pageBg` with `pageBgGradient` and `sidebarBg` with
`sidebarBgGradient`. Nothing else changes.

| Key | pageBgGradient | sidebarBgGradient |
|---|---|---|
| `navy` | `linear-gradient(160deg,#FFFDF9 0%,#F6EFE2 45%,#E3D3B9 100%)` | `linear-gradient(180deg,#F8F1E4 0%,#DECEB4 100%)` |
| `sage` | `linear-gradient(160deg,#F7FBF5 0%,#E6EEE2 50%,#C7DCC2 100%)` | `linear-gradient(180deg,#22352A 0%,#5A8064 100%)` |
| `burgundy` | `linear-gradient(160deg,#FFF7F3 0%,#F6E4DF 45%,#E6BDB4 100%)` | `linear-gradient(180deg,#4A1626 0%,#A34A54 100%)` |
| `slate` | `linear-gradient(160deg,#F8FBFD 0%,#E7ECF1 50%,#C7D4E0 100%)` | `linear-gradient(180deg,#25313C 0%,#63798D 100%)` |
| `plum` | `linear-gradient(160deg,#FBF7FF 0%,#EDE5F5 50%,#D3C0E8 100%)` | `linear-gradient(180deg,#37264A 0%,#7F639B 100%)` |
| `blush` | `linear-gradient(160deg,#FFF7F9 0%,#F8E6EC 50%,#EFC8D6 100%)` | `linear-gradient(180deg,#5E2C3D 0%,#A85F7A 100%)` |
| `seafoam` | `linear-gradient(160deg,#F3FBF9 0%,#E0F0ED 50%,#BEDFD9 100%)` | `linear-gradient(180deg,#153B38 0%,#3A7D75 100%)` |
| `sunset` | `linear-gradient(160deg,#FFF8F0 0%,#FBE7D4 50%,#F4C8A3 100%)` | `linear-gradient(180deg,#6B2F17 0%,#B0602E 100%)` |
| `winter` | `linear-gradient(160deg,#F4FAFF 0%,#DCE9F5 50%,#B3D0E9 100%)` | `linear-gradient(180deg,#0F2740 0%,#2A5078 55%,#4E85B8 100%)` |
| `valentines` | `linear-gradient(160deg,#FFF6F9 0%,#F8E3EB 50%,#EFC2D2 100%)` | `linear-gradient(180deg,#5E1530 0%,#A83A5B 55%,#C75B7C 100%)` |
| `stpatricks` | `linear-gradient(160deg,#F5FCF3 0%,#E2F0E0 50%,#C0DFBE 100%)` | `linear-gradient(180deg,#0A3A1F 0%,#1B6B3A 55%,#2C8B4E 100%)` |
| `spring` | `linear-gradient(160deg,#FBFDF6 0%,#EDF5E2 50%,#D3E6C4 100%)` | `linear-gradient(180deg,#3C6749 0%,#7BA05B 100%)` |
| `july4` | `linear-gradient(160deg,#F9FBFF 0%,#E6ECF7 50%,#C6D4EA 100%)` | `linear-gradient(180deg,#061A4A 0%,#16357F 55%,#2A4FA8 100%)` |
| `football` | `linear-gradient(160deg,#F2F9EC 0%,#DDE9D3 50%,#BCD5AB 100%)` | `linear-gradient(180deg,#152B1A 0%,#2E5636 55%,#4C8452 100%)` |
| `halloween` | `linear-gradient(160deg,#FDF2DE 0%,#F2DCB8 50%,#DDB47F 100%)` | `linear-gradient(180deg,#241B30 0%,#63401F 55%,#A85512 100%)` |
| `thanksgiving` | `linear-gradient(160deg,#FDF6EA 0%,#F3E2C8 50%,#E2C193 100%)` | `linear-gradient(180deg,#48200F 0%,#7C4426 55%,#A8622F 100%)` |
| `christmas` | `linear-gradient(160deg,#F8FBF5 0%,#E7F0E4 50%,#C8DCC6 100%)` | `linear-gradient(180deg,#0C2618 0%,#1E4D32 55%,#2F6B44 100%)` |
| `hanukkah` | `linear-gradient(160deg,#F5F9FF 0%,#E1EBF8 50%,#BFD5EE 100%)` | `linear-gradient(180deg,#0A2246 0%,#1B4A8A 55%,#2F6BB5 100%)` |
| `newyear` | `linear-gradient(160deg,#FAF8F3 0%,#EBE7DC 50%,#D2CBB6 100%)` | `linear-gradient(180deg,#0C0C10 0%,#2A2A35 55%,#454553 100%)` |

Page gradients run `160deg` (top-left to bottom-right). Sidebar gradients run
`180deg` (straight down).

---

## Holiday decoration

### Stripe

A bar across the top of the content area, `10px` tall, hidden when printing.

| Key | stripe |
|---|---|
| `winter` | `linear-gradient(90deg,#7FB2E5,#16324F,#7FB2E5)` |
| `valentines` | `linear-gradient(90deg,#A83A5B,#F7C5D9,#7A1F3D,#F7C5D9,#A83A5B)` |
| `stpatricks` | `linear-gradient(90deg,#147A3D,#E8C547,#147A3D)` |
| `spring` | `linear-gradient(90deg,#F7C5D9,#FDF2B8,#B7DCA6,#A9CCE8)` |
| `july4` | `repeating-linear-gradient(90deg,#B22234 0 16px,#FFFFFF 16px 32px)` |
| `football` | `repeating-linear-gradient(90deg,#ffffff 0 8px,#2E5636 8px 24px)` |
| `halloween` | `linear-gradient(90deg,#B4551D,#2B2138,#B4551D)` |
| `thanksgiving` | `linear-gradient(90deg,#8C3B25,#C9821F,#5A2A1E,#C9821F,#8C3B25)` |
| `christmas` | `linear-gradient(90deg,#9B2226,#F2F6EF,#123524,#F2F6EF,#9B2226)` |
| `hanukkah` | `linear-gradient(90deg,#C9A227,#0F2E5C,#C9A227)` |
| `newyear` | `linear-gradient(90deg,#B8912F,#14141A,#B8912F)` |

### Emoji sets

`titleEmoji` is the first entry and also renders before page titles.

| Key | titleEmoji | watermark set |
|---|---|---|
| `winter` | ❄️ | ❄️ ⛄ ❄️ 🌨️ ❄️ ✨ |
| `valentines` | 💕 | 💕 🌹 💌 💞 🍫 💗 |
| `stpatricks` | ☘️ | ☘️ 🍀 🌈 🪙 ☘️ ✨ |
| `spring` | 🌷 | 🌷 🐣 🌸 🦋 🌼 🐇 |
| `july4` | 🎆 | 🎆 ⭐ 🎇 🗽 ⭐ 🎆 |
| `football` | 🏈 | 🏈 🏆 🏈 📣 🏈 ⭐ |
| `halloween` | 🎃 | 🎃 🦇 🍂 🕸️ 🎃 🍁 |
| `thanksgiving` | 🦃 | 🦃 🍂 🌽 🥧 🍁 🌾 |
| `christmas` | 🎄 | 🎄 🎁 ⭐ 🎄 ❄️ 🔔 |
| `hanukkah` | 🕎 | 🕎 ✨ 🕯️ ✡️ ⭐ 🔵 |
| `newyear` | 🎉 | 🎉 🥂 ✨ 🎊 🕛 ⭐ |

### Background scatter layout

22 emojis cycled from the watermark set, positioned over a full-viewport layer
sitting beneath the content. Percentages, so it scales to any viewport.

Container: `position: fixed; inset: 0; z-index: 0; pointer-events: none;
user-select: none; overflow: hidden;` and hidden when printing. Content above it
needs `position: relative; z-index: 1` (or higher).

Each item: `position: absolute`, `line-height: 1`, with the listed
`top / left / font-size / rotate / opacity`.

| # | top | left | size | rotate | opacity |
|---|---|---|---|---|---|
| 1 | 4% | 14% | 46 | -12° | 0.30 |
| 2 | 9% | 39% | 30 | 8° | 0.24 |
| 3 | 6% | 63% | 62 | 15° | 0.28 |
| 4 | 13% | 85% | 38 | -6° | 0.26 |
| 5 | 20% | 25% | 72 | 10° | 0.30 |
| 6 | 24% | 52% | 34 | -14° | 0.22 |
| 7 | 19% | 74% | 44 | 6° | 0.27 |
| 8 | 33% | 16% | 36 | 12° | 0.25 |
| 9 | 37% | 43% | 84 | -8° | 0.29 |
| 10 | 31% | 67% | 40 | 18° | 0.24 |
| 11 | 41% | 88% | 54 | -10° | 0.28 |
| 12 | 50% | 22% | 58 | 7° | 0.30 |
| 13 | 55% | 58% | 32 | -16° | 0.23 |
| 14 | 49% | 78% | 46 | 11° | 0.26 |
| 15 | 64% | 13% | 42 | -9° | 0.27 |
| 16 | 68% | 38% | 66 | 14° | 0.29 |
| 17 | 62% | 70% | 34 | -5° | 0.22 |
| 18 | 79% | 26% | 50 | 9° | 0.28 |
| 19 | 84% | 55% | 38 | -13° | 0.25 |
| 20 | 76% | 82% | 44 | 16° | 0.24 |
| 21 | 91% | 17% | 34 | -7° | 0.23 |
| 22 | 93% | 44% | 56 | 12° | 0.27 |

Positions are hand-placed rather than randomized, so server and client renders
match and there is no hydration mismatch. Left values start past 13% to clear a
left sidebar; the bottom-right corner is left open for a logo watermark.

---

## Season windows

Windows are `[month, day]` inclusive. A window where `from > to` wraps the year
end. Compare with an ordinal (`month * 100 + day`):

```js
const ord = (m, d) => m * 100 + d

function isInSeason(season, date = new Date()) {
  if (!season) return false
  const today = ord(date.getMonth() + 1, date.getDate())
  const from = ord(season.from[0], season.from[1])
  const to = ord(season.to[0], season.to[1])
  return from <= to ? today >= from && today <= to : today >= from || today <= to
}
```

| Key | Window | Notes |
|---|---|---|
| `winter` | Dec 1 – Feb 1 | Wraps the year end. The non-denominational winter option |
| `valentines` | Feb 2 – Feb 15 | |
| `stpatricks` | Mar 8 – Mar 18 | |
| `spring` | Mar 19 – Apr 30 | Covers Easter, which moves year to year |
| `july4` | Jun 25 – Jul 8 | |
| `football` | Aug 25 – Sep 30 | Team-neutral |
| `halloween` | Oct 1 – Oct 31 | |
| `thanksgiving` | Nov 1 – Nov 30 | |
| `christmas` | Dec 1 – Dec 26 | |
| `hanukkah` | Dec 1 – Dec 31 | Actual dates move; the whole month is used |
| `newyear` | Dec 27 – Jan 7 | Wraps the year end |

Uncovered stretches, by design: May 1 – Jun 24, Jul 9 – Aug 24, Feb 16 – Mar 7.

### December policy

December deliberately returns **three** suggestions at once — Christmas,
Hanukkah, and Winter Frost. Winter Frost carries
`seasonNote: "No religious imagery"` so the neutral choice is labelled rather
than implied. Present all three side by side and let the person choose. Never
default to one.

After Dec 26 Christmas drops off, after Dec 31 Hanukkah drops off, and Winter
Frost carries the rest of winter alone through Feb 1.

---

## Implementation sketch

Framework-agnostic. Set the scheme as CSS variables on a wrapper element and
have components read them.

```css
.app {
  background: var(--page-bg);
}
.sidebar    { background: var(--sidebar-bg); }
.nav-item   { color: var(--nav-ink); }
.nav-item:hover  { background: var(--nav-hover-bg); }
.nav-item.active { background: var(--nav-active-bg); color: var(--nav-active-ink); }
.btn-primary     { background: var(--accent); color: #fff; }
h1               { color: var(--heading); }
h1::before       { content: var(--title-emoji, ""); }
.meta-strip      { border-bottom: 1px solid var(--meta-border); }
.card            { background: #fff; }
```

```js
function applyScheme(el, scheme, gradient = false) {
  const set = (k, v) => el.style.setProperty(k, v)
  set("--page-bg",       gradient ? scheme.pageBgGradient : scheme.pageBg)
  set("--sidebar-bg",    gradient ? scheme.sidebarBgGradient : scheme.sidebarBg)
  set("--nav-ink",       scheme.navInk)
  set("--nav-hover-bg",  scheme.navHoverBg)
  set("--nav-active-bg", scheme.navActiveBg)
  set("--nav-active-ink",scheme.navActiveInk)
  set("--accent",        scheme.accent)
  set("--heading",       scheme.heading)
  set("--meta-border",   scheme.metaBorder)
  set("--title-emoji",   scheme.titleEmoji ? `"${scheme.titleEmoji} "` : '""')
}
```

Note the `--title-emoji` value needs its own quotes inside the string, because
CSS `content` takes a quoted string.

### Storage

Two values per user: a scheme key (string) and a gradient flag (boolean).
Validate the key on read and fall back to your default, so a renamed or removed
scheme degrades gracefully instead of rendering nothing:

```js
const getScheme = (key) => SCHEMES[key] ?? SCHEMES[DEFAULT_KEY]
```

---

## Accessibility notes

- Contrast lives in `accent`, `heading`, `navInk` and `navActiveInk`. Those were
  chosen against their own backgrounds. If you re-pair them across schemes,
  re-check contrast.
- Gradient mode never touches those four, which is why it is safe to toggle.
- Background decoration is `aria-hidden` and non-interactive. Screen readers
  should never announce the emojis.
- Hide the decoration and stripe in print styles.
- Emoji rendering varies by platform. Nothing should depend on a specific glyph
  appearance, and the schemes still work with the decoration layer disabled
  entirely.
