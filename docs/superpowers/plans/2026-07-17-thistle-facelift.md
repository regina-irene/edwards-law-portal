# Thistle-Style Facelift (Part 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle the whole portal (client + admin) in a Thistle-inspired navy-and-cream look — big serif titles with taglines, one fixed light theme (client theme picker removed), a signature line-art motif — without changing any page's content or features.

**Architecture:** The palette is already navy/cream via CSS tokens in `app/globals.css` (`--accent: #1b2d45` navy; blue/gray Tailwind ramps remapped). This plan (1) deletes the client theme system so the one look is fixed, (2) introduces a shared `PageTitle` (title + tagline) used by the client `PageHeader` and admin pages, (3) adds a `Motif` watermark component with variants Regina picks from, (4) applies small spacing/card polish. Field Notes is a separate plan (Part 2).

**Tech Stack:** Next.js 16.2.1 App Router, React 19, Tailwind v4 (CSS `@theme` in `app/globals.css` — there is NO tailwind.config file), Jest 30 + @testing-library/react (jsdom), TypeScript.

## Global Constraints

- **Read `node_modules/next/dist/docs/` guides before writing Next.js code** — this Next.js version has breaking changes vs. training data (per AGENTS.md).
- Windows machine; shell commands below are Git Bash-compatible. Working dir: `C:\Users\regin\portal`.
- Run tests with `npx jest <path>`; full suite `npm test`. **Pre-existing failing suites (do not fix, do not worsen):** `__tests__/api/cron-reminders.test.ts`, `__tests__/api/chat.test.ts`, `__tests__/lib/twilio.test.ts`, `__tests__/api/admin-chat.test.ts`.
- Server-rendered dates must pass `timeZone: "America/New_York"`.
- Commit style: conventional (`feat:`, `fix:`, `docs:`) — see `git log`.
- Do NOT redesign page content/layouts (that's Part 3). Same information, new clothes.
- Deploy is the LAST task only, with Regina reviewing: `npx vercel --prod --scope=edwardslaw`.
- Spec: `docs/superpowers/specs/2026-07-17-thistle-facelift-and-field-notes-design.md`.

---

### Task 1: Remove the client theme system (one fixed navy/cream look)

The theme catalog, picker, and dark-text mechanics all go. The joke-of-the-day toggle stays. DB columns stay (harmless); only code stops reading them.

**Files:**
- Delete: `lib/themes.ts`
- Modify: `lib/client-prefs.ts`, `app/(client)/layout.tsx`, `components/settings/SettingsClient.tsx`, `app/(client)/settings/page.tsx`, `app/api/settings/route.ts`, `app/globals.css:56-65`, `components/announcement/FirmAnnouncementBanner.tsx:112-131`

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces: `ClientPrefs` is now `{ showJoke: boolean }`; `saveClientPrefs(clientId: string, prefs: ClientPrefs)` unchanged name; `FirmAnnouncementView({ html }: { html: string })` loses its `dark` prop. Later tasks restyle on the assumption that NO dark mode exists.

- [ ] **Step 1: Simplify `lib/client-prefs.ts`** (keeps writing `theme='classic'` so any NOT NULL constraint on the existing table stays satisfied):

```ts
// lib/client-prefs.ts — per-client portal preferences (joke of the day),
// stored in the client_prefs table and edited on the client Settings page.
// (Theme picking was removed 2026-07 — everyone gets the one navy/cream look.
// The old theme/light_text columns remain in the DB but are no longer read.)
import { sql } from "@/lib/db"

export interface ClientPrefs {
  showJoke: boolean
}

const DEFAULTS: ClientPrefs = { showJoke: false }

export async function getClientPrefs(clientId: string): Promise<ClientPrefs> {
  try {
    const r = await sql`SELECT show_joke FROM client_prefs WHERE client_id = ${String(clientId)} LIMIT 1`
    if (r.rows.length === 0) return DEFAULTS
    return { showJoke: Boolean(r.rows[0].show_joke) }
  } catch {
    return DEFAULTS
  }
}

export async function saveClientPrefs(clientId: string, prefs: ClientPrefs): Promise<void> {
  await sql`
    INSERT INTO client_prefs (client_id, theme, show_joke, light_text, updated_at)
    VALUES (${String(clientId)}, 'classic', ${prefs.showJoke}, false, now())
    ON CONFLICT (client_id)
    DO UPDATE SET show_joke = EXCLUDED.show_joke, updated_at = now()
  `
}
```

- [ ] **Step 2: Simplify `app/api/settings/route.ts`:**

```ts
import { NextResponse } from "next/server"
import { getPortalClient } from "@/lib/portal-client"
import { saveClientPrefs } from "@/lib/client-prefs"

export async function PUT(req: Request) {
  const client = await getPortalClient()
  if (!client) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json().catch(() => null)
  const showJoke = Boolean(body?.showJoke)

  await saveClientPrefs(String(client.clientId), { showJoke })
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 3: Rewrite `components/settings/SettingsClient.tsx`** — joke toggle only (keep the existing `Section` card style):

```tsx
"use client"
// components/settings/SettingsClient.tsx — joke-of-the-day toggle.
// (The background theme picker was removed 2026-07 — one navy/cream look for all.)

import { useState } from "react"
import { useRouter } from "next/navigation"

function Section({ title, blurb, children }: { title: string; blurb: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <h2 className="text-xs uppercase tracking-wide font-semibold mb-1" style={{ color: "#1b2d45" }}>{title}</h2>
      <p className="text-sm text-gray-500 mb-4">{blurb}</p>
      {children}
    </div>
  )
}

export default function SettingsClient({ initialShowJoke }: { initialShowJoke: boolean }) {
  const router = useRouter()
  const [showJoke, setShowJoke] = useState(initialShowJoke)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  async function save() {
    setSaving(true)
    setSaved(false)
    const res = await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ showJoke }),
    })
    setSaving(false)
    if (res.ok) {
      setSaved(true)
      router.refresh()
    }
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <Section title="Joke of the Day" blurb="A clean, family-friendly joke at the top of your portal. A fresh one appears every 4 hours.">
        <label className="flex items-center gap-3 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={showJoke}
            onChange={(e) => setShowJoke(e.target.checked)}
            className="h-5 w-5 rounded border-gray-300"
          />
          <span className="text-sm text-gray-800 font-medium">Show me a silly joke 😄</span>
        </label>
      </Section>

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
```

- [ ] **Step 4: Update `app/(client)/settings/page.tsx`** — the `SettingsClient` call (line 25) becomes:

```tsx
      <SettingsClient initialShowJoke={prefs.showJoke} />
```

- [ ] **Step 5: Fix the client layout.** In `app/(client)/layout.tsx`: delete the `getTheme` import (line 10); delete `const theme = getTheme(prefs.theme)` and `const darkText = ...` (lines 73-75); replace the outer wrapper + meta strip + joke strip (lines 83, 95-114) with fixed light styling:

```tsx
    <div className="flex min-h-screen" style={{ background: "#FBF8F3" }}>
```

```tsx
        {/* Meta strip */}
        <div className="flex items-center justify-between px-6 py-2 border-b print:hidden" style={{ borderColor: "#E8DFD2" }}>
          <span className="section-label">{today}</span>
          <span className="text-[12px]" style={{ color: "#334155" }}>{firstName}</span>
        </div>
        <FirmAnnouncementView html={firmAnnouncement} />
        {joke && (
          <div
            className="px-6 py-1.5 text-center text-sm italic border-b print:hidden"
            style={{ color: "#4b443b", background: "rgba(255,255,255,0.85)", borderColor: "#E8DFD2" }}
          >
            😄 {joke}
          </div>
        )}
```

- [ ] **Step 6: Remove the `dark` prop from `FirmAnnouncementView`** in `components/announcement/FirmAnnouncementBanner.tsx` (line 112): signature becomes `{ html }: { html: string }`; keep only the light branch of every `dark ? x : y` expression inside it (lines 118, 119, 125, 127, 129).

- [ ] **Step 7: Delete `lib/themes.ts`, and delete the `.theme-dark` CSS** (comment + two rule blocks, `app/globals.css:56-65`). Leave `keep-ink` class attributes in JSX alone — they're inert now.

- [ ] **Step 8: Verify nothing references the deleted module:**

Run: `npx tsc --noEmit 2>&1 | head -30` — expect no errors mentioning `themes`, `getTheme`, `lightText`, or `dark` props. Then `grep -rn "lib/themes\|getTheme\|lightText" app components lib --include="*.tsx" --include="*.ts"` — expect no hits.

- [ ] **Step 9: Run the test suite:**

Run: `npm test`
Expected: same failures as baseline ONLY (cron-reminders, chat, twilio, admin-chat).

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat: one navy/cream look for everyone — remove client theme picker"
```

---

### Task 2: Taglines library

**Files:**
- Create: `lib/taglines.ts`
- Test: `__tests__/lib/taglines.test.ts`

**Interfaces:**
- Produces: `taglineFor(key: string): string | null` — client pages use their page key (`"calendar"`); admin pages use `"admin:"`-prefixed keys. Tasks 3 and 4 call this.

- [ ] **Step 1: Write the failing test** (`__tests__/lib/taglines.test.ts`):

```ts
import { taglineFor } from "@/lib/taglines"

describe("taglineFor", () => {
  it("returns the tagline for a known client page", () => {
    expect(taglineFor("calendar")).toBe("Every date in your case, in one place")
  })
  it("returns the tagline for an admin page", () => {
    expect(taglineFor("admin:dashboard")).toBe("The whole practice, at a glance")
  })
  it("returns null for unknown/custom pages", () => {
    expect(taglineFor("custom-recipes")).toBeNull()
  })
})
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `npx jest __tests__/lib/taglines.test.ts`
Expected: FAIL — cannot find module `@/lib/taglines`.

- [ ] **Step 3: Create `lib/taglines.ts`:**

```ts
// lib/taglines.ts — one-line taglines under page titles (Thistle-style).
// Client keys match lib/portal-pages.ts page keys; admin keys use "admin:".
// Custom pages have no tagline (taglineFor returns null → nothing renders).
const TAGLINES: Record<string, string> = {
  dashboard: "Your case, at a glance",
  pleadings: "Every document filed in your case",
  discovery: "Requests and responses, both directions",
  status: "Where things stand — and what's been paid",
  tasks: "What needs doing, and when",
  calendar: "Every date in your case, in one place",
  messages: "Talk to your legal team",
  settings: "Make the portal yours",
  "admin:dashboard": "The whole practice, at a glance",
  "admin:clients": "Every client, one list",
  "admin:tasks": "Templates, assignments, progress",
  "admin:messages": "Every client conversation",
  "admin:pages": "What clients see on every page",
  "admin:settings": "Pages, navigation, and defaults",
}

export function taglineFor(key: string): string | null {
  return TAGLINES[key] ?? null
}
```

- [ ] **Step 4: Run the test again** — `npx jest __tests__/lib/taglines.test.ts` — Expected: PASS (3/3).

- [ ] **Step 5: Commit**

```bash
git add lib/taglines.ts __tests__/lib/taglines.test.ts
git commit -m "feat: page taglines library for Thistle-style headers"
```

---

### Task 3: Shared PageTitle + bigger client page headers

**Files:**
- Create: `components/ui/PageTitle.tsx`
- Modify: `components/ui/PageHeader.tsx:14-16,39`
- Test: `__tests__/components/ui/PageTitle.test.tsx`

**Interfaces:**
- Consumes: `taglineFor` from Task 2.
- Produces: `PageTitle({ title, tagline?, actions? }: { title: string; tagline?: string | null; actions?: React.ReactNode })` — default export. Task 4 uses it on admin pages.

- [ ] **Step 1: Write the failing test** (`__tests__/components/ui/PageTitle.test.tsx`):

```tsx
import { render, screen } from "@testing-library/react"
import "@testing-library/jest-dom"
import PageTitle from "@/components/ui/PageTitle"

describe("PageTitle", () => {
  it("renders the title as a heading", () => {
    render(<PageTitle title="Calendar / Meetings" />)
    expect(screen.getByRole("heading", { name: "Calendar / Meetings" })).toBeInTheDocument()
  })
  it("renders the tagline when given", () => {
    render(<PageTitle title="Calendar" tagline="Every date in your case, in one place" />)
    expect(screen.getByText("Every date in your case, in one place")).toBeInTheDocument()
  })
  it("renders nothing extra when tagline is null", () => {
    const { container } = render(<PageTitle title="My Page" tagline={null} />)
    expect(container.querySelectorAll("p").length).toBe(0)
  })
})
```

- [ ] **Step 2: Run it to make sure it fails** — `npx jest __tests__/components/ui/PageTitle.test.tsx` — Expected: FAIL, module not found.

- [ ] **Step 3: Create `components/ui/PageTitle.tsx`:**

```tsx
// components/ui/PageTitle.tsx — Thistle-style page heading: big serif title
// (h1 renders in Libre Baskerville via globals.css) + one-line tagline.
// Shared by the client PageHeader and admin pages.
interface PageTitleProps {
  title: string
  tagline?: string | null
  actions?: React.ReactNode
}

export default function PageTitle({ title, tagline, actions }: PageTitleProps) {
  return (
    <div className="flex items-end justify-between gap-4 flex-wrap">
      <div>
        <h1 className="text-3xl md:text-4xl font-bold text-gray-900">{title}</h1>
        {tagline && <p className="mt-1.5 text-[15px]" style={{ color: "#3a5170" }}>{tagline}</p>}
      </div>
      {actions && <div className="shrink-0 pb-1">{actions}</div>}
    </div>
  )
}
```

- [ ] **Step 4: Run the test** — `npx jest __tests__/components/ui/PageTitle.test.tsx` — Expected: PASS (3/3).

- [ ] **Step 5: Use it in `components/ui/PageHeader.tsx`.** Add imports and replace the `h1` (line 16); also upgrade the body card (line 39) `p-4`→`p-6` and `rounded-lg`→`rounded-xl`:

```tsx
import PageTitle from "@/components/ui/PageTitle"
import { taglineFor } from "@/lib/taglines"
```

```tsx
      <PageTitle title={title} tagline={taglineFor(page)} />
```

```tsx
        <div className="bg-white rounded-xl border border-gray-200 p-6">
```

- [ ] **Step 6: Full check** — `npm test` (baseline failures only) and `npx tsc --noEmit 2>&1 | head -20` (clean).

- [ ] **Step 7: Commit**

```bash
git add components/ui/PageTitle.tsx components/ui/PageHeader.tsx __tests__/components/ui/PageTitle.test.tsx
git commit -m "feat: big serif page titles with taglines (client pages)"
```

---

### Task 4: Admin page titles

Give the five main admin pages the same treatment. On each page, find the existing top heading (`<h1 ...>` near the top of the returned JSX) and replace that heading element with a `PageTitle`. Keep any buttons/controls that sat beside the old heading by passing them as `actions` if they were in the same flex row, otherwise leave them where they are.

**Files:**
- Modify: `app/(admin)/admin/page.tsx` (title "Dashboard", key `admin:dashboard`), `app/(admin)/admin/clients/page.tsx` ("Clients", `admin:clients`), `app/(admin)/admin/tasks/page.tsx` ("Tasks", `admin:tasks`), `app/(admin)/admin/messages/page.tsx` ("Message Center", `admin:messages`), `app/(admin)/admin/pages/page.tsx` ("Page Content", `admin:pages`), `app/(admin)/admin/settings/page.tsx` ("Portal Settings", `admin:settings`)

**Interfaces:**
- Consumes: `PageTitle` (Task 3), `taglineFor` (Task 2).

- [ ] **Step 1: For each file above**, add the imports and swap the heading. The pattern (example for the dashboard; repeat with each page's title/key):

```tsx
import PageTitle from "@/components/ui/PageTitle"
import { taglineFor } from "@/lib/taglines"
```

```tsx
      <PageTitle title="Dashboard" tagline={taglineFor("admin:dashboard")} />
```

If a page's existing `h1` text differs from the titles listed above (e.g. it says "Admin Dashboard"), KEEP the existing wording as the title — only the element changes. If `/admin/messages` renders its heading inside `components/messages/MessageCenter.tsx` rather than the page, apply the same swap there instead.

- [ ] **Step 2: Verify** — `npx tsc --noEmit 2>&1 | head -20` clean; `npm test` baseline-only failures.

- [ ] **Step 3: Commit**

```bash
git add "app/(admin)" components/messages
git commit -m "feat: Thistle-style titles with taglines on admin pages"
```

---

### Task 5: Signature motif component + preview page for Regina

A subtle line-art watermark in the bottom-right corner of every page. Three variants; Regina picks from a preview page; the chosen one is set as the default. Not Thistle's flower — our own artwork.

**Files:**
- Create: `components/ui/Motif.tsx`, `app/(admin)/admin/motif/page.tsx`
- Modify: `app/(client)/layout.tsx` (inside the outer wrapper, after `<Sidebar …/>`), `app/(admin)/layout.tsx` (same position)
- Test: `__tests__/components/ui/Motif.test.tsx`

**Interfaces:**
- Produces: `Motif({ variant?: "magnolia" | "rose" | "scales", size?: number, opacity?: number, fixed?: boolean })` — default export; `MOTIF_DEFAULT` exported constant (initially `"magnolia"`, updated after Regina picks).

- [ ] **Step 1: Write the failing test** (`__tests__/components/ui/Motif.test.tsx`):

```tsx
import { render } from "@testing-library/react"
import "@testing-library/jest-dom"
import Motif, { MOTIF_DEFAULT } from "@/components/ui/Motif"

describe("Motif", () => {
  it("renders an svg that is hidden from screen readers and print", () => {
    const { container } = render(<Motif />)
    const wrapper = container.firstElementChild as HTMLElement
    expect(wrapper.getAttribute("aria-hidden")).toBe("true")
    expect(wrapper.className).toContain("print:hidden")
    expect(wrapper.className).toContain("pointer-events-none")
    expect(container.querySelector("svg")).toBeInTheDocument()
  })
  it("has a valid default variant", () => {
    expect(["magnolia", "rose", "scales"]).toContain(MOTIF_DEFAULT)
  })
})
```

- [ ] **Step 2: Run it to make sure it fails** — `npx jest __tests__/components/ui/Motif.test.tsx` — Expected: FAIL, module not found.

- [ ] **Step 3: Create `components/ui/Motif.tsx`:**

```tsx
// components/ui/Motif.tsx — signature line-art watermark (Thistle-style touch,
// our own artwork). Sits in the bottom-right corner, faint, never interactive.
// Variants: magnolia branch, Cherokee rose, scales of justice.
// After Regina picks on /admin/motif, set MOTIF_DEFAULT to her choice.

export type MotifVariant = "magnolia" | "rose" | "scales"
export const MOTIF_DEFAULT: MotifVariant = "magnolia"

const NAVY = "#1b2d45"

function Petals({ cx, cy, r, count, rotate = 0 }: { cx: number; cy: number; r: number; count: number; rotate?: number }) {
  const petals = []
  for (let i = 0; i < count; i++) {
    const a = rotate + (i * 360) / count
    petals.push(
      <ellipse key={i} cx={cx} cy={cy - r} rx={r * 0.42} ry={r * 0.85}
        transform={`rotate(${a} ${cx} ${cy})`} fill="none" stroke={NAVY} strokeWidth="1.4" />
    )
  }
  return <>{petals}</>
}

function MagnoliaArt() {
  return (
    <svg viewBox="0 0 200 200" width="100%" height="100%" fill="none">
      {/* branch */}
      <path d="M14 186 C 60 150, 92 118, 132 66" stroke={NAVY} strokeWidth="2" strokeLinecap="round" />
      <path d="M74 132 C 92 128, 106 132, 116 142" stroke={NAVY} strokeWidth="1.6" strokeLinecap="round" />
      <path d="M104 96 C 88 90, 78 92, 68 84" stroke={NAVY} strokeWidth="1.6" strokeLinecap="round" />
      {/* leaves */}
      <path d="M116 142 q 16 2 22 16 q -18 2 -22 -16 Z" stroke={NAVY} strokeWidth="1.4" />
      <path d="M68 84 q -16 -6 -18 -22 q 16 4 18 22 Z" stroke={NAVY} strokeWidth="1.4" />
      {/* bloom */}
      <Petals cx={144} cy={52} r={26} count={6} rotate={12} />
      <circle cx={144} cy={52} r={6} stroke={NAVY} strokeWidth="1.4" />
      {/* bud */}
      <Petals cx={96} cy={124} r={11} count={5} rotate={30} />
    </svg>
  )
}

function RoseArt() {
  return (
    <svg viewBox="0 0 200 200" width="100%" height="100%" fill="none">
      <Petals cx={100} cy={100} r={54} count={5} rotate={0} />
      <Petals cx={100} cy={100} r={32} count={5} rotate={36} />
      <circle cx={100} cy={100} r={12} stroke={NAVY} strokeWidth="1.4" />
      <circle cx={100} cy={100} r={5} stroke={NAVY} strokeWidth="1.2" />
    </svg>
  )
}

function ScalesArt() {
  return (
    <svg viewBox="0 0 200 200" width="100%" height="100%" fill="none" stroke={NAVY}>
      <line x1="100" y1="28" x2="100" y2="168" strokeWidth="2" strokeLinecap="round" />
      <line x1="40" y1="52" x2="160" y2="52" strokeWidth="2" strokeLinecap="round" />
      <circle cx="100" cy="24" r="6" strokeWidth="1.6" />
      <line x1="70" y1="176" x2="130" y2="176" strokeWidth="2" strokeLinecap="round" />
      {/* left pan */}
      <line x1="40" y1="52" x2="24" y2="96" strokeWidth="1.4" />
      <line x1="40" y1="52" x2="56" y2="96" strokeWidth="1.4" />
      <path d="M16 96 H 64 A 24 24 0 0 1 16 96 Z" strokeWidth="1.6" />
      {/* right pan */}
      <line x1="160" y1="52" x2="144" y2="96" strokeWidth="1.4" />
      <line x1="160" y1="52" x2="176" y2="96" strokeWidth="1.4" />
      <path d="M136 96 H 184 A 24 24 0 0 1 136 96 Z" strokeWidth="1.6" />
    </svg>
  )
}

const ART: Record<MotifVariant, () => React.ReactElement> = {
  magnolia: MagnoliaArt,
  rose: RoseArt,
  scales: ScalesArt,
}

interface MotifProps {
  variant?: MotifVariant
  size?: number      // px
  opacity?: number   // 0..1
  fixed?: boolean    // corner watermark (true) vs inline block (false, preview)
}

export default function Motif({ variant = MOTIF_DEFAULT, size = 220, opacity = 0.07, fixed = true }: MotifProps) {
  const Art = ART[variant]
  return (
    <div
      aria-hidden="true"
      className={`${fixed ? "fixed bottom-2 right-2 z-0" : ""} pointer-events-none select-none print:hidden`}
      style={{ width: size, height: size, opacity }}
    >
      <Art />
    </div>
  )
}
```

- [ ] **Step 4: Run the test** — `npx jest __tests__/components/ui/Motif.test.tsx` — Expected: PASS (2/2).

- [ ] **Step 5: Create the admin preview page** `app/(admin)/admin/motif/page.tsx` (admin layout already gates auth):

```tsx
// app/(admin)/admin/motif/page.tsx — one-time picker: Regina views the three
// watermark options at full strength and tells us which to keep. Once
// MOTIF_DEFAULT is set to her choice, this page can be deleted.
import Motif, { type MotifVariant } from "@/components/ui/Motif"
import PageTitle from "@/components/ui/PageTitle"

const OPTIONS: { variant: MotifVariant; label: string; blurb: string }[] = [
  { variant: "magnolia", label: "Magnolia branch", blurb: "A Southern classic — branch with one open bloom." },
  { variant: "rose", label: "Cherokee rose", blurb: "Georgia's state flower, drawn as nested petals." },
  { variant: "scales", label: "Scales of justice", blurb: "The traditional legal mark, in thin line art." },
]

export default function MotifPreviewPage() {
  return (
    <div className="space-y-6">
      <PageTitle title="Pick your signature graphic" tagline="It appears faintly in the corner of every page — here it's shown at full strength." />
      <div className="grid md:grid-cols-3 gap-6">
        {OPTIONS.map((o) => (
          <div key={o.variant} className="bg-white rounded-xl border border-gray-200 p-6 text-center">
            <div className="mx-auto" style={{ width: 220, height: 220 }}>
              <Motif variant={o.variant} fixed={false} opacity={0.9} size={220} />
            </div>
            <p className="mt-3 font-semibold text-gray-900">{o.label}</p>
            <p className="text-sm text-gray-500">{o.blurb}</p>
          </div>
        ))}
      </div>
      <p className="text-sm text-gray-500">Tell Claude which one you like and it becomes the portal's watermark.</p>
    </div>
  )
}
```

- [ ] **Step 6: Add the watermark to both layouts.** In `app/(client)/layout.tsx` and `app/(admin)/layout.tsx`, inside the outer `<div className="flex min-h-screen" …>` immediately after the sidebar component, add:

```tsx
      <Motif />
```

with import `import Motif from "@/components/ui/Motif"`.

- [ ] **Step 7: Verify** — `npm test` baseline-only; `npx tsc --noEmit 2>&1 | head -20` clean.

- [ ] **Step 8: Commit**

```bash
git add components/ui/Motif.tsx "app/(admin)/admin/motif" "app/(client)/layout.tsx" "app/(admin)/layout.tsx" __tests__/components/ui/Motif.test.tsx
git commit -m "feat: signature line-art watermark with admin preview page"
```

---

### Task 6: Whitespace polish + status page joins the one look

**Files:**
- Modify: `app/(client)/layout.tsx:115` and `app/(admin)/layout.tsx:25` (main padding), `app/(client)/status/page.tsx:67-70` (ocean gradient), `components/nav/NavItem.tsx:24` (inactive label color)

- [ ] **Step 1: Roomier main content area.** In both layouts, change the `<main>` class to:

```tsx
        <main className="flex-1 px-6 py-8 md:px-10 overflow-auto relative z-10">{children}</main>
```

(`relative z-10` keeps content above the corner motif.)

- [ ] **Step 2: Status page drops its own ocean-gradient background** so it matches the rest of the portal (spec decision — flagged for Regina at review). Replace `app/(client)/status/page.tsx:67-70`:

```tsx
    <div className="space-y-6">
```

(The `-m-6 … keep-ink` wrapper div with the `linear-gradient` style is removed entirely; keep everything inside it. The closing tag stays as the same `</div>`.)

- [ ] **Step 3: NavItem inactive color to warm navy.** In `components/nav/NavItem.tsx:24` change `text-[#4b443b]` to `text-[#33404c]`.

- [ ] **Step 4: Verify** — `npm test` baseline-only failures; `npx tsc --noEmit 2>&1 | head -20` clean. Also `npx jest __tests__/lib/billing.test.ts` still passes (status page imports unchanged).

- [ ] **Step 5: Commit**

```bash
git add "app/(client)" "app/(admin)/layout.tsx" components/nav/NavItem.tsx
git commit -m "feat: roomier spacing; status page joins the navy/cream look"
```

---

### Task 7: Build, deploy, Regina reviews

- [ ] **Step 1: Production build** — Run: `npm run build`. Expected: compiles with no errors (warnings OK).

- [ ] **Step 2: Full suite one more time** — `npm test`, baseline failures only.

- [ ] **Step 3: Deploy** — `npx vercel --prod --scope=edwardslaw`. Expected: deployment URL printed.

- [ ] **Step 4: Ask Regina to review on the live site**, specifically: (a) the bigger titles + taglines on each page, (b) `/admin/motif` — pick the watermark (then set `MOTIF_DEFAULT` to her pick, delete `app/(admin)/admin/motif/page.tsx`, redeploy), (c) confirm she's happy that the Status page no longer has the ocean-blue background, (d) confirm the theme picker being gone feels right. Fix anything she flags before starting Part 2 (Field Notes plan).

---

## Self-Review Notes

- Spec coverage: theme removal (Task 1), titles+taglines client (Tasks 2-3) and admin (Task 4), motif with Regina-pick flow (Task 5), whitespace/cards (Tasks 3, 5, 6), status-gradient decision surfaced to Regina (Tasks 6-7), fonts unchanged (no task needed), amber announcement stays amber (untouched), admin sidebar stays white (untouched). Field Notes = separate plan (Part 2), written after this ships.
- The palette was already navy/cream via `globals.css` tokens — no token task needed; verified against the live file.
- Line numbers cited are from 2026-07-17 file state; re-verify before editing if other commits land first.
