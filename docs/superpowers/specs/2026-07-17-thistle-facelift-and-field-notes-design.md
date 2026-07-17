# Thistle-Style Facelift + Field Notes — Design

**Date:** 2026-07-17
**Inspiration:** thistleltd.com (Field Notes blog, Cases / Calendar / Notes product pages)
**Approved by Regina:** design sections approved in chat 2026-07-17 (Part 1 look ✔, Part 2 Field Notes ✔, sequencing "Foundation first" ✔, themes "Replace" ✔).

## Overview

Two projects, built in order:

1. **Part 1 — The Look:** restyle the whole portal (client + admin) in a Thistle-inspired
   navy-and-cream style: bigger headlines with taglines, generous whitespace, clean white
   cards, one consistent look. Client-selectable themes are **removed**.
2. **Part 2 — Field Notes:** a new **admin-only** per-client running case log that merges
   Regina's typed notes with automatic portal events (messages, uploads, form answers,
   task completions). Clients can never see it.

**Part 3 (later, out of scope here):** page-by-page spruce-ups inspired by Thistle's
Cases/Calendar/Notes pages — each its own mini-project with Regina approving each page.

## Part 1 — The Look

### Palette & tokens
- Deep navy (target ~`#1B2A4A`, tuned during build) becomes the primary color for
  headings, sidebar labels/active states, primary buttons, links, and chips that are
  currently assorted blues/grays.
- Cream page background stays (existing `#F5EEE3`); content in white rounded cards with
  more padding and vertical spacing between sections.
- The amber Firm Announcements strip stays amber (it must pop).
- Define the palette as Tailwind theme tokens (e.g. `navy`, `cream`) in one place and
  sweep existing ad-hoc color classes to them, so Part 3 pages inherit automatically.

### Typography & page headers
- Keep existing fonts: Libre Baskerville (headings) + Inter (body).
- Every page header becomes: large bold Baskerville title + a short one-line tagline in
  muted navy beneath it (Thistle-style). Taglines are hardcoded defaults per built-in
  page; the existing editable page `header` still overrides the title.
- `PageHeader` (client) and admin page headers both adopt this treatment.

### Signature motif
- Do **not** copy Thistle's flower (their brand). Add a subtle line-art motif of our own
  (candidates: magnolia, Cherokee rose — Georgia references) as a soft corner watermark
  on page backgrounds, low opacity, never behind text.
- Implementation: inline SVG component; 2–3 options mocked up during build; Regina picks.

### Theme removal
- Remove the theme picker from the client Settings page; keep the joke-of-the-day toggle
  (and the Settings page itself).
- Delete/stop using: `lib/themes.ts` theme catalog (NFL/MLB wallpapers, gradients, dark),
  `client_prefs.theme` + `light_text` reads, the `theme-dark` CSS mechanics in
  `globals.css`, and dark-variant styling that exists only to support themes
  (e.g. `dark` props on banners). The `client_prefs` table/columns stay in the DB
  (harmless) — only the UI and lookups go.
- Everyone gets the one navy/cream look. Status page keeps its ocean-gradient exception
  only if Regina confirms during build; default assumption: it is restyled to match the
  new system too (its `keep-ink` machinery goes away with themes).

### Layouts
- Client sidebar: cream; admin sidebar: **stays white** so Regina can tell the two apart
  at a glance. Both get the new navy typography, spacing, and active-state styling.
- The top date/meta strip on both layouts is restyled but keeps the
  `America/New_York` timezone rule.

### Non-goals for Part 1
- No page content/layout changes (that's Part 3). Same information, same features,
  new clothes.

## Part 2 — Field Notes (admin-only per-client case log)

### Access & privacy
- Lives entirely under `/admin` (protected by the existing admin auth, `requireAdmin` /
  `admin_users`). No client-facing route, API, or nav entry exposes any of it.
- Manual notes stored in the portal's Vercel Postgres (private), never in Airtable and
  never returned by any client API.

### Navigation
- New **Field Notes** item in the admin sidebar (`/admin/notes`).
- New 📝 icon-button on each client row on `/admin` (client list), linking to
  `/admin/notes/[clientId]`, matching the existing icon-over-label row buttons.

### Hub page — `/admin/notes`
- Clients A→Z using the same display labels as the admin client list
  (`client_labels` override → `clientDisplayLabel`).
- Each row: client name, snippet (first ~140 chars, tags stripped) of their most recent
  manual note + its date; clients with no notes yet show a muted "No notes yet".
- Search box: searches the text of **manual notes** across all clients (SQL `ILIKE` on a
  plain-text shadow of the body); results grouped by client. Automatic events are not
  searched (they're derivable data, not notes).

### Client timeline — `/admin/notes/[clientId]`
- Header: client name + link back to hub; Print button (reuses `PrintButton`,
  `print:hidden` on chrome, like Messages print view).
- **Composer at top:** existing `RichTextEditor` (sanitized via `lib/sanitize.ts`,
  inline images via the existing content-image flow). Save = insert, stamped with
  created-at (shown in ET). Notes are editable and deletable afterwards
  (edited notes show an "edited" marker).
- **Timeline below, newest first**, one merged stream:
  - **Manual notes:** white card, navy left border — visually primary.
  - **Auto events:** lighter, compact rows with icon + one-line description + timestamp:
    - 💬 chat messages both senders, incl. SMS variants (`chat_messages`, existing
      `sms_status` tags) and legacy one-way `messages`
    - 📎 file uploads (`task_attachments` scope `client_task`, `message_attachments`)
    - 📋 form answers updated (`form_responses`)
    - ✅ task completed (`client_tasks` where `status='done'`, using new `completed_at`)
  - Auto events are **queried live** from those tables at render (same UNION approach as
    the admin dashboard activity feed) — nothing copied, nothing to drift.
- **Filter toggle:** Everything / Just my notes.
- Long histories: initial load caps events (e.g. most recent 200 merged items) with a
  "Show older" link that extends the range; manual notes are never truncated out of the
  "Just my notes" view.

### Data changes
```sql
CREATE TABLE IF NOT EXISTS client_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id TEXT NOT NULL,          -- String(clientId), same normalization as elsewhere
  body TEXT NOT NULL,               -- sanitized HTML
  body_text TEXT NOT NULL,          -- plain-text shadow for search/snippets
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ            -- set on edit; "edited" marker when present
);
CREATE INDEX IF NOT EXISTS client_notes_client_idx ON client_notes (client_id, created_at DESC);

ALTER TABLE client_tasks ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
```
- `PATCH /api/tasks` (client toggle) and any admin toggle set `completed_at = NOW()`
  when marking done, `NULL` when un-checking. Tasks completed before this ships have no
  timestamp and simply don't appear in timelines (acceptable; noted to Regina).
- Migration runs via the established direct-`node` method (npm run migrate is broken).

### API
- `/api/admin/notes` (admin-only): `GET ?clientId=` list, `POST` create,
  `PATCH` edit, `DELETE` remove. Timeline auto events are fetched server-side in the
  page component, not via API.

### Error handling
- Airtable label fetch fails → fall back to raw client ids, page still renders.
- Any single auto-event source failing → that source is skipped (fail-soft `.catch`,
  same pattern as the dashboard), manual notes always render.
- Empty states: friendly copy on hub and timeline ("No notes yet — write the first one").

## Testing
- Unit: note snippet/plain-text extraction; timeline merge ordering (mixed sources,
  same-minute ordering stable); `completed_at` set/cleared by the tasks PATCH.
- Existing suites must stay green (known pre-existing failures: cron-reminders, chat,
  twilio, admin-chat — not ours).
- Manual verification on deployed site (blob/OIDC features only work deployed).

## Rollout
1. Part 1 foundation (tokens + shared components + theme removal) — deploy, Regina eyeballs.
2. Part 2 Field Notes — deploy behind admin auth, Regina uses it immediately.
3. Part 3 page spruce-ups — separate specs, one page at a time.

## Out of scope
- Part 3 page redesigns (Cases-style status page ideas, Calendar page ideas, etc.).
- Public-facing blog/articles (Regina chose admin-only).
- Auto-noting Drive dropzone uploads (files go straight to Google Drive; the portal
  doesn't record them today — could be a Part 3 follow-up).
- Read receipts / templates (existing messaging backlog, unrelated).
