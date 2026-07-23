# Client Color Schemes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let clients pick one of 8 curated color schemes on /settings; the choice recolors their portal (background, sidebar, accents, plus festive decorations on 3 seasonal schemes).

**Architecture:** A pure-data `lib/color-schemes.ts` defines the 8 schemes. The client layout resolves the client's scheme from `client_prefs.theme` (existing, unused column) and sets CSS custom properties on the layout wrapper; Sidebar/NavItem/PageTitle read those vars with today's values as fallbacks, so the admin layout (which sets no vars) is untouched. Seasonal schemes additionally render a festive stripe, floating emoji watermarks, and an emoji before page titles (CSS `::before`).

**Tech Stack:** Next.js 16 App Router, Tailwind + inline styles, @vercel/postgres, Jest (ts-jest).

## Global Constraints

- Default scheme `navy` must render EXACTLY today's portal — every CSS var fallback equals the current hardcoded value (`#FBF8F3` page bg, `#F5EEE3` sidebar, `#1B2D45` active nav/buttons, `#33404c` nav ink, `#efe7da` nav hover).
- Admin layout must not change (it never sets the vars).
- All schemes: light background, dark ink, text on solid white cards. No `.theme-dark`, no `keep-ink` changes.
- Seasonal decorations must be `print:hidden` and `pointer-events-none`.
- Unknown/legacy `client_prefs.theme` values (e.g. `'classic'`, `'nfl-falcons'`) must resolve to `navy` — never crash.
- Scheme keys: `navy`, `sage`, `burgundy`, `slate`, `plum`, `halloween`, `winter`, `football`.

---

### Task 1: Scheme definitions (`lib/color-schemes.ts`) + unit test

**Files:**
- Create: `lib/color-schemes.ts`
- Test: `__tests__/lib/color-schemes.test.ts`

**Interfaces:**
- Produces: `interface ColorScheme`, `SCHEMES: Record<string, ColorScheme>`, `DEFAULT_SCHEME_KEY = "navy"`, `getScheme(key: string | null | undefined): ColorScheme`, `SCHEME_KEYS: string[]`.

- [ ] **Step 1: Write the failing test**

```ts
// __tests__/lib/color-schemes.test.ts
import { getScheme, SCHEMES, SCHEME_KEYS, DEFAULT_SCHEME_KEY } from "@/lib/color-schemes"

describe("color schemes", () => {
  it("has exactly the 8 approved schemes", () => {
    expect(SCHEME_KEYS.sort()).toEqual(
      ["burgundy", "football", "halloween", "navy", "plum", "sage", "slate", "winter"].sort()
    )
  })

  it("falls back to navy for unknown, legacy, null and undefined keys", () => {
    expect(getScheme("classic").key).toBe("navy")
    expect(getScheme("nfl-falcons").key).toBe("navy")
    expect(getScheme(null).key).toBe("navy")
    expect(getScheme(undefined).key).toBe("navy")
  })

  it("returns the requested scheme for valid keys", () => {
    for (const key of SCHEME_KEYS) expect(getScheme(key).key).toBe(key)
  })

  it("navy matches today's portal exactly", () => {
    const navy = SCHEMES[DEFAULT_SCHEME_KEY]
    expect(navy.pageBg).toBe("#FBF8F3")
    expect(navy.sidebarBg).toBe("#F5EEE3")
    expect(navy.accent).toBe("#1B2D45")
    expect(navy.seasonal).toBe(false)
    expect(navy.stripe).toBeNull()
    expect(navy.watermark).toEqual([])
  })

  it("seasonal schemes have decorations, core schemes have none", () => {
    for (const key of ["halloween", "winter", "football"]) {
      const s = SCHEMES[key]
      expect(s.seasonal).toBe(true)
      expect(s.stripe).toBeTruthy()
      expect(s.watermark.length).toBeGreaterThanOrEqual(4)
      expect(s.titleEmoji).toBeTruthy()
    }
    for (const key of ["navy", "sage", "burgundy", "slate", "plum"]) {
      expect(SCHEMES[key].seasonal).toBe(false)
    }
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/lib/color-schemes.test.ts`
Expected: FAIL — cannot find module `@/lib/color-schemes`.

- [ ] **Step 3: Write the implementation**

```ts
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
  },
  sage: {
    key: "sage", name: "Sage & Forest", blurb: "Calm greens, natural and steady.",
    seasonal: false,
    pageBg: "#EEF2EA", sidebarBg: "#2E4636", sidebarLogoBg: "#ffffff",
    navInk: "#dde7dc", navHoverBg: "rgba(255,255,255,.14)", navActiveBg: "rgba(255,255,255,.22)", navActiveInk: "#ffffff",
    accent: "#2E4636", heading: "#2E4636", metaBorder: "#d8e0d4",
    stripe: null, watermark: [], titleEmoji: null,
  },
  burgundy: {
    key: "burgundy", name: "Burgundy & Blush", blurb: "Warm and elegant.",
    seasonal: false,
    pageBg: "#F7EEEC", sidebarBg: "#5C2233", sidebarLogoBg: "#ffffff",
    navInk: "#eddade", navHoverBg: "rgba(255,255,255,.14)", navActiveBg: "rgba(255,255,255,.22)", navActiveInk: "#ffffff",
    accent: "#5C2233", heading: "#5C2233", metaBorder: "#e6d4d0",
    stripe: null, watermark: [], titleEmoji: null,
  },
  slate: {
    key: "slate", name: "Slate & Mist", blurb: "Cool, crisp and modern.",
    seasonal: false,
    pageBg: "#EEF1F4", sidebarBg: "#33414E", sidebarLogoBg: "#ffffff",
    navInk: "#dbe2e8", navHoverBg: "rgba(255,255,255,.14)", navActiveBg: "rgba(255,255,255,.22)", navActiveInk: "#ffffff",
    accent: "#33414E", heading: "#33414E", metaBorder: "#d7dde3",
    stripe: null, watermark: [], titleEmoji: null,
  },
  plum: {
    key: "plum", name: "Plum & Lavender", blurb: "Gentle and distinctive.",
    seasonal: false,
    pageBg: "#F2EEF6", sidebarBg: "#46325A", sidebarLogoBg: "#ffffff",
    navInk: "#e4dcee", navHoverBg: "rgba(255,255,255,.14)", navActiveBg: "rgba(255,255,255,.22)", navActiveInk: "#ffffff",
    accent: "#46325A", heading: "#46325A", metaBorder: "#ded4e8",
    stripe: null, watermark: [], titleEmoji: null,
  },
  halloween: {
    key: "halloween", name: "Autumn Twilight", blurb: "Pumpkins, candlelight and a friendly bat. 🎃",
    seasonal: true,
    pageBg: "#F5E6CE", sidebarBg: "linear-gradient(180deg,#2B2138,#3A2A1A)", sidebarLogoBg: "#ffffff",
    navInk: "#f0e4d0", navHoverBg: "rgba(255,255,255,.14)", navActiveBg: "rgba(255,255,255,.22)", navActiveInk: "#ffffff",
    accent: "#B4551D", heading: "#8A3D14", metaBorder: "#e0c9a8",
    stripe: "linear-gradient(90deg,#B4551D,#2B2138,#B4551D)",
    watermark: ["🎃", "🦇", "🍂", "🕸️", "🎃", "🍁"], titleEmoji: "🎃",
  },
  winter: {
    key: "winter", name: "Winter Frost", blurb: "Snow, frost and sparkle — happy holidays. ❄️",
    seasonal: true,
    pageBg: "#E3EDF6", sidebarBg: "linear-gradient(180deg,#16324F,#2A5078)", sidebarLogoBg: "#ffffff",
    navInk: "#dcebf8", navHoverBg: "rgba(255,255,255,.16)", navActiveBg: "rgba(255,255,255,.24)", navActiveInk: "#ffffff",
    accent: "#2A5078", heading: "#16324F", metaBorder: "#c8daea",
    stripe: "linear-gradient(90deg,#7FB2E5,#16324F,#7FB2E5)",
    watermark: ["❄️", "⛄", "❄️", "🌨️", "❄️", "✨"], titleEmoji: "❄️",
  },
  football: {
    key: "football", name: "Game Day", blurb: "Turf, yard lines and touchdowns — team-neutral. 🏈",
    seasonal: true,
    pageBg: "#E4EEDD", sidebarBg: "linear-gradient(180deg,#1E3B24,#2E5636)", sidebarLogoBg: "#ffffff",
    navInk: "#dfeeda", navHoverBg: "rgba(255,255,255,.14)", navActiveBg: "rgba(255,255,255,.22)", navActiveInk: "#ffffff",
    accent: "#5C3A1E", heading: "#1E3B24", metaBorder: "#c9dcbf",
    stripe: "repeating-linear-gradient(90deg,#ffffff 0 8px,#2E5636 8px 24px)",
    watermark: ["🏈", "🏆", "🏈", "📣", "🏈", "⭐"], titleEmoji: "🏈",
  },
}

export const SCHEME_KEYS = Object.keys(SCHEMES)

export function getScheme(key: string | null | undefined): ColorScheme {
  return (key && SCHEMES[key]) || SCHEMES[DEFAULT_SCHEME_KEY]
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest __tests__/lib/color-schemes.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/color-schemes.ts __tests__/lib/color-schemes.test.ts
git commit -m "feat: define the 8 client color schemes"
```

---

### Task 2: Store the scheme in client prefs + accept it in the settings API

**Files:**
- Modify: `lib/client-prefs.ts` (whole file, small)
- Modify: `app/api/settings/route.ts` (whole file, small)

**Interfaces:**
- Consumes: `getScheme`, `SCHEMES` from `lib/color-schemes` (Task 1).
- Produces: `ClientPrefs = { showJoke: boolean; scheme: string }` — `scheme` is always a VALID scheme key (getClientPrefs normalizes legacy values via `getScheme`). `saveClientPrefs(clientId, prefs)` writes `prefs.scheme` into the existing `client_prefs.theme` column (no migration needed).

- [ ] **Step 1: Update `lib/client-prefs.ts`**

```ts
// lib/client-prefs.ts — per-client portal preferences (color scheme + joke
// of the day), stored in the client_prefs table and edited on the client
// Settings page. The scheme reuses the old `theme` column; legacy values
// ('classic', old wallpaper keys) normalize to the default navy scheme.
import { sql } from "@/lib/db"
import { getScheme, DEFAULT_SCHEME_KEY } from "@/lib/color-schemes"

export interface ClientPrefs {
  showJoke: boolean
  scheme: string
}

const DEFAULTS: ClientPrefs = { showJoke: false, scheme: DEFAULT_SCHEME_KEY }

export async function getClientPrefs(clientId: string): Promise<ClientPrefs> {
  try {
    const r = await sql`SELECT show_joke, theme FROM client_prefs WHERE client_id = ${String(clientId)} LIMIT 1`
    if (r.rows.length === 0) return DEFAULTS
    return {
      showJoke: Boolean(r.rows[0].show_joke),
      scheme: getScheme(r.rows[0].theme ? String(r.rows[0].theme) : null).key,
    }
  } catch {
    return DEFAULTS
  }
}

export async function saveClientPrefs(clientId: string, prefs: ClientPrefs): Promise<void> {
  await sql`
    INSERT INTO client_prefs (client_id, theme, show_joke, light_text, updated_at)
    VALUES (${String(clientId)}, ${prefs.scheme}, ${prefs.showJoke}, false, now())
    ON CONFLICT (client_id)
    DO UPDATE SET theme = EXCLUDED.theme, show_joke = EXCLUDED.show_joke, updated_at = now()
  `
}
```

- [ ] **Step 2: Update `app/api/settings/route.ts`**

```ts
import { NextResponse } from "next/server"
import { getPortalClient } from "@/lib/portal-client"
import { saveClientPrefs } from "@/lib/client-prefs"
import { SCHEMES, DEFAULT_SCHEME_KEY } from "@/lib/color-schemes"

export async function PUT(req: Request) {
  const client = await getPortalClient()
  if (!client) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json().catch(() => null)
  const showJoke = Boolean(body?.showJoke)
  const scheme = typeof body?.scheme === "string" ? body.scheme : DEFAULT_SCHEME_KEY
  if (!SCHEMES[scheme]) return NextResponse.json({ error: "Unknown color scheme" }, { status: 400 })

  await saveClientPrefs(String(client.clientId), { showJoke, scheme })
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 3: Verify types compile**

Run: `npx tsc --noEmit`
Expected: no NEW errors (pre-existing errors in unrelated test suites are OK if already present on main).

- [ ] **Step 4: Commit**

```bash
git add lib/client-prefs.ts app/api/settings/route.ts
git commit -m "feat: store the client's color scheme in client_prefs.theme"
```

---

### Task 3: Apply the scheme in the client layout (CSS vars + decorations)

**Files:**
- Modify: `app/(client)/layout.tsx`
- Modify: `components/nav/Sidebar.tsx`
- Modify: `components/nav/NavItem.tsx`
- Modify: `app/globals.css` (append)
- Create: `components/ui/SchemeDecor.tsx`

**Interfaces:**
- Consumes: `getScheme` (Task 1), `prefs.scheme` (Task 2).
- Produces: CSS custom properties available under the client layout wrapper: `--scheme-accent`, `--scheme-heading`, `--sidebar-bg`, `--sidebar-logo-bg`, `--nav-ink`, `--nav-hover-bg`, `--nav-active-bg`, `--nav-active-ink`, `--scheme-title-emoji`. Sidebar prop `baseEmoji?: string | null`.

- [ ] **Step 1: Create `components/ui/SchemeDecor.tsx`**

```tsx
// components/ui/SchemeDecor.tsx — festive background layer for seasonal
// color schemes: ~6 large, faint emojis floating over the page background.
// Sits under the content (main is relative z-10); hidden when printing.
import type { ColorScheme } from "@/lib/color-schemes"

const SPOTS: { top: string; left: string; size: number }[] = [
  { top: "12%", left: "22%", size: 44 },
  { top: "28%", left: "58%", size: 36 },
  { top: "46%", left: "34%", size: 48 },
  { top: "60%", left: "72%", size: 40 },
  { top: "74%", left: "28%", size: 36 },
  { top: "86%", left: "56%", size: 44 },
]

export default function SchemeDecor({ scheme }: { scheme: ColorScheme }) {
  if (!scheme.seasonal || scheme.watermark.length === 0) return null
  return (
    <div aria-hidden="true" className="fixed inset-0 z-0 pointer-events-none select-none print:hidden">
      {SPOTS.map((spot, i) => (
        <span
          key={i}
          className="absolute"
          style={{ top: spot.top, left: spot.left, fontSize: spot.size, opacity: 0.15 }}
        >
          {scheme.watermark[i % scheme.watermark.length]}
        </span>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Append nav + title CSS to `app/globals.css`**

```css
/* Client color schemes (2026-07-23): nav items + page-title emoji read CSS
   vars set by the client layout; fallbacks = today's hardcoded values, so
   the admin layout (no vars) is unchanged. */
.nav-item { color: var(--nav-ink, #33404c); }
.nav-item:hover { background: var(--nav-hover-bg, #efe7da); }
.nav-item.nav-item-active {
  background: var(--nav-active-bg, #1B2D45);
  color: var(--nav-active-ink, #ffffff);
}
.nav-item.nav-item-active:hover { background: var(--nav-active-bg, #1B2D45); }
h1.page-title::before { content: var(--scheme-title-emoji, ""); }
```

- [ ] **Step 3: Switch `components/nav/NavItem.tsx` to the CSS classes**

Replace the `className` conditional on the `Link`:

```tsx
      className={`nav-item relative w-[84px] py-2.5 rounded-xl flex flex-col items-center gap-1.5 transition-colors ${
        isActive ? "nav-item-active" : ""
      }`}
```

(The rest of the file is unchanged.)

- [ ] **Step 4: Scheme-aware `components/nav/Sidebar.tsx`**

Change the `aside` + logo + add optional base emoji:

```tsx
interface SidebarProps {
  pages: NavPage[]
  unreadMessages: number
  unreadChat: number
  baseEmoji?: string | null
}

export default function Sidebar({ pages, unreadMessages, unreadChat, baseEmoji }: SidebarProps) {
  const getUnread = (key: string) => (key === "messages" ? unreadMessages : key === "chat" ? unreadChat : 0)

  return (
    <aside
      className="w-24 shrink-0 flex flex-col items-center py-4 gap-1.5 border-r print:hidden"
      style={{ borderColor: "#E8DFD2", background: "var(--sidebar-bg, #F5EEE3)" }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/efl-logo.png"
        alt="Edwards Family Law"
        className="mb-3 w-16 h-16 object-contain rounded-xl p-0.5"
        style={{ background: "var(--sidebar-logo-bg, transparent)" }}
      />
      <nav className="flex-1 flex flex-col items-center gap-1">
        {pages.map((p) => (
          <NavItem key={p.key} href={p.href} label={p.label} icon={ICONS[p.key] ?? "📄"} unreadCount={getUnread(p.key)} />
        ))}
      </nav>
      {baseEmoji && <div aria-hidden="true" className="text-2xl pb-1">{baseEmoji}</div>}
      <div className="pt-2">
        <SignOutButton />
      </div>
    </aside>
  )
}
```

- [ ] **Step 5: Set the vars + decorations in `app/(client)/layout.tsx`**

Add imports:

```tsx
import { getScheme } from "@/lib/color-schemes"
import SchemeDecor from "@/components/ui/SchemeDecor"
```

After `const joke = ...`, resolve the scheme:

```tsx
  const scheme = getScheme(prefs.scheme)
```

Replace the outer wrapper `<div className="flex min-h-screen" style={{ background: "#FBF8F3" }}>` with:

```tsx
    <div
      className="flex min-h-screen"
      style={{
        background: scheme.pageBg,
        ["--scheme-accent" as string]: scheme.accent,
        ["--scheme-heading" as string]: scheme.heading,
        ["--sidebar-bg" as string]: scheme.sidebarBg,
        ["--sidebar-logo-bg" as string]: scheme.sidebarLogoBg,
        ["--nav-ink" as string]: scheme.navInk,
        ["--nav-hover-bg" as string]: scheme.navHoverBg,
        ["--nav-active-bg" as string]: scheme.navActiveBg,
        ["--nav-active-ink" as string]: scheme.navActiveInk,
        ["--scheme-title-emoji" as string]: scheme.titleEmoji ? `"${scheme.titleEmoji} "` : '""',
      }}
    >
```

Pass the base emoji to the sidebar and add the decorations:

```tsx
      <Sidebar pages={pages} unreadMessages={unread.messages} unreadChat={unread.chat} baseEmoji={scheme.titleEmoji} />
      <Motif />
      <SchemeDecor scheme={scheme} />
```

Add the festive stripe as the FIRST child of the content column (directly above the preview banner), inside `<div className="flex-1 flex flex-col min-h-0">`:

```tsx
        {scheme.stripe && <div className="h-1.5 shrink-0 print:hidden" style={{ background: scheme.stripe }} />}
```

Also swap the meta-strip border color so seasonal borders match:
`style={{ borderColor: "#E8DFD2" }}` → `style={{ borderColor: scheme.metaBorder }}` (meta strip div only).

- [ ] **Step 6: Verify**

Run: `npx tsc --noEmit` — no new errors.
Run: `npm run dev` and load `/dashboard` — with no prefs row the portal must look EXACTLY as before (navy defaults).

- [ ] **Step 7: Commit**

```bash
git add app/(client)/layout.tsx components/nav/Sidebar.tsx components/nav/NavItem.tsx app/globals.css components/ui/SchemeDecor.tsx
git commit -m "feat: client layout applies the chosen color scheme via CSS vars"
```

---

### Task 4: Heading + button accents follow the scheme

**Files:**
- Modify: `components/ui/PageTitle.tsx`
- Modify: `components/settings/SettingsClient.tsx` (button color only — the picker UI is Task 5)

**Interfaces:**
- Consumes: `--scheme-heading`, `--scheme-accent` vars (Task 3).

- [ ] **Step 1: PageTitle uses the heading var + `page-title` class**

```tsx
        <h1 className="page-title text-3xl md:text-4xl font-bold" style={{ color: "var(--scheme-heading, #111827)" }}>{title}</h1>
```

(Replaces the current `text-gray-900` h1 line; rest of file unchanged. Admin pages render PageTitle too — no vars set there, so the fallback `#111827` = the old `text-gray-900` color.)

- [ ] **Step 2: Save button uses the accent var in `SettingsClient.tsx`**

Replace `style={{ background: "#1b2d45" }}` on the Save button with:

```tsx
          style={{ background: "var(--scheme-accent, #1b2d45)" }}
```

And the section-heading color `style={{ color: "#1b2d45" }}` with:

```tsx
          style={{ color: "var(--scheme-heading, #1b2d45)" }}
```

- [ ] **Step 3: Verify + commit**

Run: `npx tsc --noEmit` — no new errors.

```bash
git add components/ui/PageTitle.tsx components/settings/SettingsClient.tsx
git commit -m "feat: headings and primary buttons follow the color scheme"
```

---

### Task 5: Scheme picker on the Settings page

**Files:**
- Modify: `components/settings/SettingsClient.tsx`
- Modify: `app/(client)/settings/page.tsx`

**Interfaces:**
- Consumes: `SCHEMES`, `SCHEME_KEYS`, `ColorScheme` (Task 1); `PUT /api/settings` accepting `{ showJoke, scheme }` (Task 2); `prefs.scheme` (Task 2).
- Produces: `SettingsClient` props become `{ initialShowJoke: boolean; initialScheme: string }`.

- [ ] **Step 1: Pass the scheme from the page**

In `app/(client)/settings/page.tsx`:

```tsx
      <SettingsClient initialShowJoke={prefs.showJoke} initialScheme={prefs.scheme} />
```

- [ ] **Step 2: Add the picker section to `SettingsClient.tsx`**

Add imports and swatch component at the top of the file:

```tsx
import { SCHEMES, SCHEME_KEYS, type ColorScheme } from "@/lib/color-schemes"

function SchemeSwatch({ scheme, selected, onSelect }: { scheme: ColorScheme; selected: boolean; onSelect: () => void }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`text-left rounded-xl border-2 overflow-hidden transition-shadow ${
        selected ? "border-gray-800 shadow-md" : "border-gray-200 hover:border-gray-400"
      }`}
    >
      <div className="flex h-16" style={{ background: scheme.pageBg }}>
        <div className="w-6 shrink-0" style={{ background: scheme.sidebarBg }} />
        <div className="flex-1 p-2">
          <div className="h-2 w-16 rounded" style={{ background: scheme.accent }} />
          <div className="mt-1.5 h-6 rounded bg-white border border-gray-200 flex items-center px-1.5">
            {scheme.titleEmoji && <span className="text-xs">{scheme.titleEmoji}</span>}
          </div>
        </div>
      </div>
      <div className="px-3 py-2 bg-white">
        <p className="text-sm font-semibold text-gray-900">{scheme.name}{selected ? " ✓" : ""}</p>
        <p className="text-xs text-gray-500">{scheme.blurb}</p>
      </div>
    </button>
  )
}
```

Update the component signature and state:

```tsx
export default function SettingsClient({ initialShowJoke, initialScheme }: { initialShowJoke: boolean; initialScheme: string }) {
  const router = useRouter()
  const [showJoke, setShowJoke] = useState(initialShowJoke)
  const [scheme, setScheme] = useState(initialScheme)
```

Send the scheme on save (body of the fetch):

```tsx
      body: JSON.stringify({ showJoke, scheme }),
```

Add the picker section as the FIRST section inside the returned `<div className="space-y-6 max-w-3xl">`:

```tsx
      <Section title="Color Scheme" blurb="Pick the look of YOUR portal. Every scheme keeps things easy to read — seasonal ones add a little extra fun.">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {SCHEME_KEYS.map((key) => (
            <SchemeSwatch key={key} scheme={SCHEMES[key]} selected={scheme === key} onSelect={() => setScheme(key)} />
          ))}
        </div>
      </Section>
```

- [ ] **Step 3: Verify in the browser**

Run: `npm run dev`, open `/settings` (admin preview as any client): 8 swatches render, clicking one highlights it, Save shows "Saved! ✓", and after `router.refresh()` the page recolors (background, sidebar, headings, button). Reload — choice persists.

- [ ] **Step 4: Commit**

```bash
git add components/settings/SettingsClient.tsx "app/(client)/settings/page.tsx"
git commit -m "feat: color scheme picker on the client settings page"
```

---

### Task 6: Full verification + deploy

- [ ] **Step 1: Run the test suite**

Run: `npx jest __tests__/lib/color-schemes.test.ts __tests__/lib/billing.test.ts`
Expected: PASS. (cron-reminders, chat, twilio, admin-chat suites fail on main already — pre-existing, ignore.)

- [ ] **Step 2: Production build**

Run: `npm run build`
Expected: compiles clean.

- [ ] **Step 3: Manual pass via admin preview**

For at least `navy`, `sage`, `halloween`: check dashboard, messages, status (manila case-file card must stay manila; billing section readable), settings, print preview of pleadings (no emojis/stripe in print). Confirm the admin panel itself still looks unchanged.

- [ ] **Step 4: Deploy**

```bash
npx vercel --prod --scope=edwardslaw
```

- [ ] **Step 5: Verify live + report to Regina in plain English.**
