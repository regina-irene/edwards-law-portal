# Edwards Family Law - Portal Design Spec

A self-contained reference for reproducing the "Mail-style" admin look on any
project. Copy this file into your new portal repo or hand it to a developer
(or another AI) and they should be able to build a UI that visually matches
the FileFlow admin.

The look is intentionally quiet - small typography, hairline borders, no
shadows, single accent color. Inspired by Linear / Notion / iOS Settings.

---

## 1. Layout architecture

```
┌────┬─────────────────────────────────────────────────────────────┐
│    │  Meta strip (date · weather · user)                         │
│ I  ├─────────────────────────────────────────────────────────────┤
│ c  │  (optional) Announcement banner                             │
│ o  ├─────────────────────────────────────────────────────────────┤
│ n  │  (optional) Joke of the day strip                           │
│    ├─────────────────────────────────────────────────────────────┤
│ R  │                                                             │
│ a  │   ┌────────────┬───────────────────────────────────────┐   │
│ i  │   │            │                                       │   │
│ l  │   │ List col   │       Detail pane                     │   │
│    │   │  (300px)   │       (flex-1, scrolls)               │   │
│    │   │            │                                       │   │
│    │   └────────────┴───────────────────────────────────────┘   │
└────┴─────────────────────────────────────────────────────────────┘
   80px                       flex-1 (main area)
```

**Top-level container:** `h-screen flex` - fills viewport, never scrolls
at the body level.

- **Icon rail (left):** fixed-width column of nav items. 80px wide,
  full-height. Each item is icon + label stacked vertically.
- **Main area (right):** `flex-1`, vertical stack of thin chrome strips on
  top, scrollable content fills the rest.
- **Within sections that want list+detail** (e.g. "Matters"): the section
  layout subdivides the right area into a 300px list column on the left and
  a `flex-1` detail pane that scrolls independently.

---

## 2. Color tokens

Use these exact hex codes. Don't substitute "close enough" colors - the
quietness depends on the specific muted grays.

| Name        | Hex       | Use                                              |
|-------------|-----------|--------------------------------------------------|
| `paper`     | `#FFFFFF` | Page background. Crisp white.                    |
| `paperEdge` | `#E7E5E4` | Inline chips, slightly deeper than surface.      |
| `surface`   | `#F5F5F4` | Cards, panels, hover backgrounds. Stone-100.     |
| `ink`       | `#0F172A` | Primary text - page titles, body emphasis.       |
| `inkBody`   | `#334155` | Body copy. Slate-700.                            |
| `inkMuted`  | `#64748B` | Secondary text - descriptions, microcopy.        |
| `inkDim`    | `#94A3B8` | Section labels, the quietest text.               |
| `hairline`  | `#E2E8F0` | Every divider, every card border. Always 1px.    |
| `accent`    | `#1A2A4A` | Single primary color - navy. Active state, CTAs. |
| `accentHov` | `#0F1A33` | Hover state for accent.                          |

**Status colors** (use sparingly - only for status pills and progress fill):

| Name      | Hex       | Use                                          |
|-----------|-----------|----------------------------------------------|
| `done`    | `#10B981` | Complete · Active · success.                 |
| `waiting` | `#F59E0B` | In-progress · Draft · pending.               |
| `urgent`  | `#DC2626` | Overdue · error · destructive.               |
| `inert`   | `#CBD5E1` | Inactive · empty state.                      |

Status pill backgrounds use the 50/100 tints of those colors with a
darker matching text color (e.g. Active = `bg:#DCFCE7` `text:#15803D`).

---

## 3. Typography

**Fonts**

- **Sans (body, UI):** Geist - fallback `system-ui, -apple-system, sans-serif`.
  Free swap: **Inter** (Google Fonts) - visually similar enough.
- **Serif (page titles only):** Tailwind's default serif stack
  (`ui-serif, Georgia, Cambria, "Times New Roman", Times, serif`).
- **Mono (numbers, code):** Geist Mono - fallback `ui-monospace, SF Mono,
  Menlo, monospace`. Use the `tabular-nums` feature for all counts so
  digits don't shift width when numbers change.

**Type scale**

| Use                | Class / styles                                                |
|--------------------|---------------------------------------------------------------|
| Page title         | `text-2xl font-serif font-bold tracking-tight` · `ink`        |
| Section heading    | `text-base font-semibold` · `ink`                             |
| **Section label**  | `text-[10px] uppercase tracking-[0.18em] font-semibold` · `inkDim` |
| Body               | `text-sm` (14px) · `inkBody`                                  |
| Microcopy / counts | `text-[11px]` · `inkMuted`                                    |
| Stat value (card)  | `text-[18–22px] font-semibold tabular-nums` · `ink`           |
| Stat label (card)  | `text-[10px] uppercase tracking-wider` · `inkDim`             |

The 10px uppercase tracked label is the signature. Use it for every section
heading inside a page. It's quiet but unambiguous - readers scan it like a
table of contents.

---

## 4. Spacing & layout primitives

**Standard spacing rhythm**

| Token        | Pixel value | Tailwind  | Use                                |
|--------------|-------------|-----------|------------------------------------|
| Tight        | 4 px        | `gap-1`   | Inside chip / between label+value  |
| Snug         | 8 px        | `gap-2`   | Inside cards                       |
| Default      | 12 px       | `gap-3`   | Grid gaps, card padding            |
| Section      | 16 px       | `gap-4`   | Between siblings inside section    |
| Page rhythm  | 24 px       | `space-y-6` | Vertical space between sections  |

**Page padding:** `px-6 py-6` (24px) on the main scroll container.

**Card / panel radius:** `rounded-lg` (8px). Never larger than 12px. Never
square-cornered - softness is part of the calm.

**Borders:** Always 1px solid `hairline` (`#E2E8F0`). Never thicker.

**Shadows:** None on cards/panels by default. Only use a tiny shadow
(`0 1px 2px rgba(15,23,42,0.04)`) for floating dropdown menus. Never use
multi-layer shadows or glows.

---

## 5. Component patterns

### Page title row

```jsx
<div className="flex items-baseline justify-between gap-3 flex-wrap">
  <div>
    <p className="text-[11px]" style={{ color: '#64748B' }}>{breadcrumb}</p>
    <h1
      className="text-2xl font-serif font-bold tracking-tight"
      style={{ color: '#0F172A' }}
    >
      {pageTitle}
    </h1>
  </div>
  {/* right-side actions */}
</div>
```

### Section header (with optional meta on the right)

```jsx
<div
  className="flex items-baseline justify-between pb-2 border-b"
  style={{ borderColor: '#E2E8F0' }}
>
  <h2
    className="text-[10px] uppercase tracking-[0.18em] font-semibold"
    style={{ color: '#94A3B8' }}
  >
    {sectionLabel}
  </h2>
  <span className="text-xs tabular-nums" style={{ color: '#64748B' }}>
    {meta /* e.g. "12 of 18 received · 67%" */}
  </span>
</div>
```

### Stat card (used in dashboards)

```jsx
<div
  className="rounded-lg border p-3 flex flex-col gap-2"
  style={{ borderColor: '#E2E8F0', background: '#F5F5F4' }}
>
  <p
    className="text-[10px] uppercase tracking-[0.2em] font-semibold"
    style={{ color: '#94A3B8' }}
  >
    {label}
  </p>
  <p
    className="text-[20px] font-semibold tabular-nums"
    style={{ color: '#0F172A' }}
  >
    {value}
  </p>
  <p className="text-[11px]" style={{ color: '#64748B' }}>
    {subtext}
  </p>
</div>
```

### Status pill (Active / Draft / Closed / Overdue)

```jsx
<span
  className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border"
  style={{
    background: '#DCFCE7',
    color: '#15803D',
    borderColor: '#BBF7D0',
  }}
>
  Active
</span>
```

Swap colors for other statuses:
- Active: `#DCFCE7` bg · `#15803D` text · `#BBF7D0` border
- Draft / waiting: `#FEF3C7` · `#A16207` · `#FDE68A`
- Closed / inert: `#F1F5F9` · `#64748B` · `#E2E8F0`
- Overdue / urgent: `#FEE2E2` · `#B91C1C` · `#FECACA`

### Icon-rail item (icon + label stacked)

```jsx
<a
  href={href}
  aria-label={label}
  className="w-[68px] py-1.5 rounded-lg flex flex-col items-center gap-0.5 transition-colors"
  style={{
    background: active ? '#1A2A4A' : 'transparent',
    color: active ? '#FFFFFF' : '#334155',
  }}
>
  <span className="text-[18px] leading-none">{icon}</span>
  <span className="text-[10px] font-medium leading-tight">{label}</span>
</a>
```

The rail itself: 80px wide, `flex flex-col items-center py-3 gap-1`,
background `#F5F5F4` (or `#FFFFFF`) with a 1px right border.

### List column item (Mail-style list of records)

```jsx
<a
  href={`/path/${id}`}
  className="block px-4 py-3 border-b border-l-2 transition-colors"
  style={{
    borderColor: '#E2E8F0',
    borderLeftColor: active ? '#1A2A4A' : 'transparent',
    background: active ? '#E7E5E4' : 'transparent',
  }}
>
  <div className="flex items-baseline justify-between gap-2">
    <p className="text-[12px] font-semibold truncate" style={{ color: '#0F172A' }}>
      {title}
    </p>
    <span className="text-[10px]" style={{ color: '#94A3B8' }}>
      {relativeTime}
    </span>
  </div>
  <p className="text-[11px] truncate" style={{ color: '#64748B' }}>
    {subtitle}
  </p>
  {/* optional progress bar */}
  <div className="mt-1.5 h-1 rounded-full" style={{ background: '#E2E8F0' }}>
    <div
      className="h-full rounded-full"
      style={{ width: `${pct}%`, background: pct === 100 ? '#10B981' : '#1A2A4A' }}
    />
  </div>
</a>
```

### Primary button

```jsx
<button
  className="px-3 py-1.5 text-sm font-medium rounded-md text-white transition-colors hover:bg-[#0F1A33]"
  style={{ background: '#1A2A4A' }}
>
  Save
</button>
```

### Secondary / ghost button

```jsx
<button
  className="px-3 py-1.5 text-xs font-medium rounded-md border bg-white hover:bg-stone-50"
  style={{ borderColor: '#E2E8F0', color: '#334155' }}
>
  Cancel
</button>
```

### Input

```jsx
<input
  className="w-full text-sm px-3 py-1.5 rounded border focus:outline-none focus:ring-2"
  style={{ borderColor: '#E2E8F0', background: '#FFFFFF' }}
/>
```

Focus ring color: any 30% opacity tint of accent - e.g. `ring-blue-500/30`.

### Empty state

```jsx
<div className="h-full flex flex-col items-center justify-center text-center py-16">
  <div className="text-5xl mb-4">📋</div>
  <h1
    className="text-xl font-serif font-bold tracking-tight"
    style={{ color: '#0F172A' }}
  >
    {title}
  </h1>
  <p className="text-sm mt-2 max-w-md" style={{ color: '#64748B' }}>
    {description}
  </p>
</div>
```

---

## 6. Numbers, dates, times

- **All numeric values use `tabular-nums`** so digits don't shift width when
  numbers change. Critical for progress counts, deadlines, timestamps.
- **Dates:** `Apr 14, 2026` (short month + numeric day + year). No leading
  zeros on day. Use `toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })`.
- **Times:** `9:42 AM` - never 24-hour. Append timezone for cross-context
  data (`9:42 AM EDT`).
- **Relative time:** `12m ago`, `3h ago`, `2d ago`, then fall back to absolute
  date (`Apr 14`) at 7+ days.

---

## 7. Interaction rules

- **Hover:** Subtle bg shift to `#F5F5F4` (surface) on rows and buttons. Never
  use scale, never use shadows on hover.
- **Active row / selected item:** Left border accent stripe (2px `#1A2A4A`)
  + slightly deeper bg (`#E7E5E4`). Don't bold the text.
- **Focus:** Always visible ring at 2px, accent color at 30% opacity. Never
  remove focus outlines.
- **Loading:** Use the text "Loading…" inline rather than spinners. Skeleton
  shimmer is too loud for this look.
- **Errors:** Use `urgent` color (`#DC2626`) for the icon and the label, but
  the message text itself stays `inkBody`. Don't paint the whole panel red.

---

## 8. The "DO / DON'T" list

| Do                                              | Don't                                       |
|-------------------------------------------------|---------------------------------------------|
| Hairline borders, 1px, `#E2E8F0`                | Thicker borders or "fat" outlines           |
| 10px uppercase tracked labels                   | 14px+ section headers competing with titles |
| One accent color (navy), used sparingly         | Multiple competing accent colors            |
| Cards on a soft surface (`#F5F5F4`)             | Cards with shadows or gradients             |
| `tabular-nums` on every number                  | Proportional digits in numeric columns      |
| Small icon (16–18px) with text label            | Icon-only nav with hover-only labels        |
| Status as a small colored pill                  | Whole rows painted with status color        |
| Empty state with one big emoji + one sentence   | Long onboarding flows on empty pages        |
| Serif headlines, sans body                      | Mixing fonts inside body text               |
| Soft rounded corners (6–12px)                   | Sharp corners or pill-shaped containers     |

---

## 9. Minimal CSS-variable starter

If you want to wire this up in vanilla CSS, drop this in your global stylesheet:

```css
:root {
  --paper:       #FFFFFF;
  --paper-edge:  #E7E5E4;
  --surface:     #F5F5F4;
  --ink:         #0F172A;
  --ink-body:    #334155;
  --ink-muted:   #64748B;
  --ink-dim:     #94A3B8;
  --hairline:    #E2E8F0;
  --accent:      #1A2A4A;
  --accent-hov:  #0F1A33;
  --done:        #10B981;
  --waiting:     #F59E0B;
  --urgent:      #DC2626;
  --inert:       #CBD5E1;
  --font-sans:   "Geist", "Inter", system-ui, -apple-system, sans-serif;
  --font-serif:  ui-serif, Georgia, Cambria, "Times New Roman", Times, serif;
  --font-mono:   "Geist Mono", ui-monospace, "SF Mono", Menlo, monospace;
}

body {
  background: var(--paper);
  color: var(--ink);
  font-family: var(--font-sans);
  -webkit-font-smoothing: antialiased;
}

.section-label {
  font-size: 10px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  font-weight: 600;
  color: var(--ink-dim);
}

.card {
  background: var(--surface);
  border: 1px solid var(--hairline);
  border-radius: 8px;
  padding: 12px;
}

.hairline {
  border-color: var(--hairline);
}
```

---

## 10. Reference build

Live example to compare against: **https://fileflow-eta.vercel.app**. Once
signed in, look at:

- `/admin/matters` - split-pane list + detail (the full Mail pattern)
- `/admin/intake` - card grid with preview/edit buttons
- `/admin/settings` - long form on a stone surface

Right-click anywhere → Inspect to confirm exact pixel values if anything in
this spec disagrees with what's on screen. (Screen is source of truth.)
