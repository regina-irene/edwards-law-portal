# Portal Audit — 18 Aug 2026

Full-codebase review of the Edwards Family Law client portal, covering client
UX, admin UX, performance, and polish/accessibility. Roughly 50 findings; the
ones worth acting on are below, ordered so that the highest value per hour of
work comes first.

Every item cites `file:line` so it can be picked up directly.

---

## 0. Fix these first — not polish

### 0.1 The admin composer is shared across conversations
`components/messages/MessageCenter.tsx:49-56` and `:293`

`body`, `pendingFiles`, `alsoText` and `rich` are single pieces of state.
Clicking a different conversation changes `selected` but leaves the half-typed
message, the queued attachments and the "also send as text" checkbox in place,
now aimed at a different client. Type a reply to the Smith case, get
interrupted, click Jones to check something, hit send — Smith's text goes to
Jones.

In a family law practice that is a confidentiality incident, not a UX wrinkle.

**Fix:** key drafts by client id (`Record<clientId, Draft>`), restore on select,
clear the composer when `selected` changes. Persist to `localStorage` so an
accidental reload doesn't lose work, and show a "Draft" chip on conversation
rows that have one.

### 0.2 `/mockups` is publicly reachable with no authentication
`app/mockups/page.tsx`

A six-layout design exploration page containing fake client names and fake case
data. It has no `auth()` call, no `requireAdmin()`, and there is no
`middleware.ts` in the repo, so `https://clients.edwardsfamilylaw.com/mockups`
renders to anyone who guesses the URL.

**Fix:** delete `app/mockups/`, or gate it behind `requireAdmin()`.

### 0.3 A failed send looks exactly like a successful one
`components/messages/ClientThread.tsx:117-126` (client side)
`components/messages/MessageCenter.tsx:175-210` (admin side)

Both send paths wrap the entire success branch in `if (res.ok)` with no `else`.
On failure the spinner stops, the text stays in the box, and nothing is said.
The client cannot tell whether their attorney received the message.

**Fix:** an error banner above the composer that keeps the draft and offers
retry. Same pattern needed in `components/settings/SettingsClient.tsx:36-49`,
`components/admin/PageContentEditor.tsx:95`, and
`app/(admin)/admin/settings/page.tsx:113-118` (which reports "Saved!"
unconditionally, without checking `res.ok` at all).

---

## 1. Why it feels slow

Ranked by how much each contributes to the lag on a click.

### 1.1 The client layout is a six-stage waterfall on every navigation
`app/(client)/layout.tsx:33, 38, 42, 69, 75`

Nothing paints until all of this resolves *in order*:

1. `auth()`
2. `getPortalClient()` — which internally does `auth()` again, then
   `getActivePreviewEmail()` (a third `auth()` + a DB query), then an Airtable
   HTTP call
3. `getActivePreviewEmail()` **again**, duplicating work just done
4. a `Promise.all` of four, one of which (`getClientNav`) is itself five queries
   in a two-level dependency tree
5. `getJokeOfTheDay()` — **an external HTTP call to icanhazdadjoke.com**, run
   sequentially after the rest

`app/(client)/loading.tsx` cannot help, because it sits *below* the layout: the
spinner can't render until the layout finishes. This is the single biggest
reason every click feels heavy.

**Fix:** dedupe the auth/preview calls with `React.cache`, fold everything into
one `Promise.all`, and wrap the joke and announcement strips in `<Suspense>` so
the shell and sidebar stream immediately.

### 1.2 The calendar blocks on up to three Claude API calls
`app/(client)/calendar/page.tsx:38` → `lib/event-notes-ai.ts:15, 72-90`

`getFormattedNotes()` fires up to three Anthropic calls at `max_tokens: 2000`
and awaits all of them before returning any HTML. A client whose case has three
uncached court-notice events waits through three LLM generations before the
calendar paints.

The cache key is a hash of the description, so any calendar re-sync that changes
whitespace invalidates it and the wait comes back. Also worth checking: the
model id at `lib/event-notes-ai.ts:26` is `claude-opus-4-8`, which does not look
like a real model string — if it 404s, every first render pays full latency and
still shows plain text.

**Fix:** render the calendar immediately with plain-text notes and move the AI
formatting into a `<Suspense>` boundary or a background job. Never await an LLM
in a page render path.

### 1.3 Missing database indexes on the hottest tables
`scripts/migrate.ts:61-76, 96-105`

`chat_messages` and `messages` have **no indexes at all** beyond their primary
keys — no `client_id`, no `created_at`, no `read`. They are queried on every
single page load (`app/(client)/layout.tsx:20-21` counts unread on both tables)
and every 30-second poll.

`client_tasks` likewise has no `(client_id, status)` index despite being queried
that way on the dashboard, the tasks page, and the admin dashboard.

**Fix** (one migration, no app changes):

```sql
CREATE INDEX ON chat_messages (client_id, created_at DESC);
CREATE INDEX ON chat_messages (client_id) WHERE sender='client' AND read=false;
CREATE INDEX ON messages (client_id, created_at DESC);
CREATE INDEX ON messages (client_id) WHERE read=false;
CREATE INDEX ON client_tasks (client_id, status, due_date);
CREATE INDEX ON client_tasks (template_id);
```

Highest ratio of speed gained to effort spent in this document.

### 1.4 Every admin page refetches the whole Airtable client roster, uncached
`lib/airtable.ts:160-168` — `fetchAllClientsRaw()` uses `cache: "no-store"`

Called from twelve places, including on every render of the admin dashboard,
Clients, Field Notes, and Forms. Airtable's list endpoint runs 300-800ms and is
rate-limited to 5 requests/second per base, so several admin tabs open at once
will hit 429s — which show up as pages that hang and then render with no client
names.

The cached sibling `getAllClients()` at `lib/airtable.ts:137` already does the
right thing. The admin side is simply calling the wrong function. A comment at
`lib/airtable.ts:157-159` refers to a `lib/clients-cache.ts` that does not exist
in the repo.

**Fix:** wrap in `unstable_cache` with a `clients` tag; have the Refresh button
and `saveClientLabel` call `revalidateTag('clients')`.

### 1.5 The admin dashboard runs a six-table union with a `NOT IN` subquery
`app/(admin)/admin/page.tsx:22-33`

Six tables are scanned in full, unioned, materialized, anti-joined against
`dismissed_activity`, sorted, and only then limited to 500. No index can help,
because the sort happens after the union. It runs on every `/admin` load and
gets slower forever as the tables grow.

**Fix:** push `ORDER BY created_at DESC LIMIT 500` into each branch of the union
so each can use an index, and replace `NOT IN` with `NOT EXISTS`.

### 1.6 The full WYSIWYG editor ships to every client page
`components/ui/RichTextEditor.tsx:1` and `:227`

`RichTextView` — a trivial `dangerouslySetInnerHTML` div — is exported from the
same `"use client"` module as the 220-line editor with image upload, colour
pickers and font menus. `components/ui/PageHeader.tsx:3` imports `RichTextView`,
and `PageHeader` appears on nearly every client page. So the entire editor is in
the client bundle of every page a client visits, and clients can never edit
anything.

Same shape in `app/(client)/layout.tsx:15`, which imports `FirmAnnouncementView`
from a `"use client"` module that also pulls in the editor and the admin save
logic.

**Fix:** move `RichTextView` to its own file (it needs no `"use client"` at all)
and split `FirmAnnouncementView` out of the admin banner module. Two file
splits, no behaviour change.

### 1.7 Assigning tasks is a literal N+1
`app/api/admin/tasks/route.ts:140-150`

A `for` loop doing one `SELECT` and one `INSERT` per template. Assigning a
20-template intake set is 40 sequential round-trips, roughly 1.6 seconds of
spinner on one of the most-used admin actions.

**Fix:** one statement —
`INSERT INTO client_tasks (…) SELECT …, $clientId FROM task_templates WHERE id = ANY($ids) RETURNING *`

### 1.8 The 30-second poll writes to the database every time
`components/messages/ClientThread.tsx:111` → `app/api/chat/route.ts:14`

Each poll runs an unconditional `UPDATE chat_messages SET read = true` before
the select — a write transaction on an unindexed table even when nothing is
unread. It also re-runs `getPortalClient()` (three `auth()` calls plus an
Airtable lookup) each time, and keeps polling while the tab is in the
background.

**Fix:** only run the update when there are unread firm messages, pause the
interval on `document.hidden`, and back off to 60 seconds.

### 1.9 Case Status downloads three entire Airtable tables
`app/(client)/status/page.tsx:33-39`

`getClientBilling` (`lib/billing.ts:52-84`) pages through the firm-wide
payments table and then filters for this client in JavaScript. `getCaseEvents`
(`lib/calendar.ts:90-110`) does the same with the firm-wide events table. Each
is an internally serial `do…while(offset)` loop.

**Fix:** push the filter into Airtable with `filterByFormula` and `fields[]`
instead of downloading every row.

---

## 2. Why it feels clunky

### 2.1 There is no mobile layout
`components/nav/Sidebar.tsx:30`, `components/nav/NavItem.tsx:23`,
`app/globals.css` (**zero `@media` queries in the entire stylesheet**)

On a 390px phone the icon rail permanently eats a quarter of the screen,
leaving about 246px of usable content once `main`'s padding is subtracted.
Labels like "Case Status" wrap to three lines. There is no hamburger, no
drawer, no bottom bar.

Related: the message thread is pinned to `calc(100vh - 18rem)`
(`components/messages/ClientThread.tsx:141`), which on an iPhone SE leaves a
280px thread with the composer below the fold — and `100vh` ignores mobile
browser chrome, so it is worse in practice. Pleadings and Discovery are
five-column tables with `whitespace-nowrap` that simply scroll sideways
(`components/pleadings/PleadingsTable.tsx:70-71`,
`components/discovery/DiscoveryTable.tsx:68-69`), putting "View file" — the one
thing a client wants — off-screen.

Divorce clients are overwhelmingly on phones. This is the largest single source
of "clunky".

**Fix:** hide the rail below `md` and add a bottom tab bar; `h-[70dvh]` for the
thread; stacked cards instead of tables below `md`.

### 2.2 Sending files leaves no trace anywhere
`components/messages/ClientThread.tsx:128-137`,
`components/messages/UploadDocsButton.tsx:61-70`,
`app/api/file-dropzone/route.ts:33-41`

The file goes straight to Google Drive. No message row is created, the modal
just sits there with green ticks, and closing it leaves the conversation
byte-for-byte unchanged. A client who has just uploaded their bank statements
has no evidence it worked, so they either upload again or message asking
whether it arrived.

**Fix:** have the upload route insert a client chat message ("📎 Sent 3 files:
…") and have the modal close with a "Sent to your legal team ✓" confirmation.

### 2.3 The unread badge reads the wrong table
`app/(client)/layout.tsx:20-25`, `components/nav/Sidebar.tsx:26`,
`lib/portal-pages.ts:4-13`

The sidebar maps `key === "messages"` to the count from the legacy `messages`
table and `key === "chat"` to `chat_messages`. But there is no `chat` key in the
nav definitions, so the `chat_messages` count is dead code — and the client
Messages page only ever reads `chat_messages`.

Net effect: a real reply from the attorney produces **no badge**, while any
legacy row produces a badge the client can never clear.

**Fix:** one-line change at `Sidebar.tsx:26` to use `unreadChat`.

### 2.4 The admin Message Center never refreshes itself
`components/messages/MessageCenter.tsx:130-153`

It loads once on mount and once per conversation click. There is no interval —
while the *client* side polls every 30 seconds. So new client messages never
appear until you click away and back or hard-reload.

**Fix:** a 20-second interval guarded on `document.visibilityState`, skipping
auto-scroll when the user has scrolled up.

### 2.5 "Access Not Found" is a dead end
`app/(client)/layout.tsx:43-54`

A client who signs in with a personal Gmail rather than the address on file gets
a bare centered paragraph. No sign-out, no "try a different email", no phone
number, no mailto. The session persists, so reloading returns the same wall
forever. This is the most likely place a non-technical client gives up and
phones the office.

**Fix:** a sign-out button, the firm's phone number, and an echo of which email
they actually signed in with.

### 2.6 No error, not-found, or admin loading pages exist
Glob of `app/**/{error,not-found,loading,global-error}.tsx` returns exactly one
file: `app/(client)/loading.tsx`.

So `notFound()` at `app/(client)/p/[slug]/page.tsx:17` drops the client onto
Next's default black-and-white 404 with no sidebar and no way back, and any
server throw produces an unstyled error screen. The admin side has no
`loading.tsx` at all, so every admin navigation shows a frozen previous page.

**Fix:** add `error.tsx` and `not-found.tsx` for both route groups, an
`app/(admin)/loading.tsx`, and a root `global-error.tsx`.

### 2.7 Failures render as reassuring empty states
`components/messages/ClientThread.tsx:104-107`,
`components/tasks/TasksClient.tsx:51-56`,
`app/(client)/dashboard/page.tsx:26`

Each fetches, and on any error falls through to an empty array. The UI then
renders "No messages yet", "No tasks assigned yet.", and "You're all caught up
— no outstanding tasks. 🎉".

A client with an overdue court-ordered upload sees a party emoji telling them
they are all caught up. The empty state and the error state must never share a
render path.

The correct pattern already exists in this repo at
`app/(client)/discovery/page.tsx:61-63`.

### 2.8 Nothing confirms an action worked
`components/dashboard/OutstandingTasks.tsx:36-43`,
`components/tasks/TasksClient.tsx:87-89`

A failed task-completion PATCH silently rolls the checkbox back. The user
assumes they mis-tapped, taps again, and the same thing happens. There is no
toast layer anywhere in the app.

**Fix:** one shared toast/inline-error component.

### 2.9 Twelve native browser dialogs
`window.prompt` at `MessageCenter.tsx:78`, `RichTextEditor.tsx:95, 177`;
`alert` at `TasksClient.tsx:71`, `MessageCenter.tsx:92`, `RichTextEditor.tsx:105`,
`PageContentEditor.tsx:117`; `confirm` at `InviteButton.tsx:15`,
`NotesTimeline.tsx:62`, `FormBuilder.tsx:165`,
`app/(admin)/admin/settings/page.tsx:128`, `app/(admin)/admin/forms/page.tsx:87`.

`TasksClient.tsx:71` is the worst — it is client-facing, and a Chrome dialog
reading `clients.edwardsfamilylaw.com says: Upload failed (max 25MB).` in the
middle of a law firm portal reads as broken software.

A proper focus-managed `ConfirmDialog` already exists at
`components/admin/tasks/bits.tsx:77`, used only inside Tasks.

**Fix:** promote `ConfirmDialog`, `InlineError` and `UndoBanner` out of
`components/admin/tasks/` into `components/ui/` and use them everywhere.

### 2.10 Destructive actions have no undo
`components/notes/NotesTimeline.tsx:61-66` (field notes are hard-deleted behind
a `confirm()`), `components/admin/forms/FormBuilder.tsx:111-119` (`removeField`
deletes a question instantly with **no** confirm), `TasksClient.tsx:227`.

Field notes are the private case log. A mis-clicked delete is unrecoverable.
The ten-second `UndoBanner` at `components/admin/tasks/bits.tsx:174` is the
right answer and already exists.

### 2.11 Long-form work is lost with no warning
`components/admin/forms/FormBuilder.tsx:505` (Cancel discards the whole draft,
no confirm), `components/notes/NotesTimeline.tsx:21-47` (draft is plain
`useState`), `components/admin/PageContentEditor.tsx:20`.

Rebuild a 65-question intake form, click a nav item, and it is gone. There is no
`beforeunload` handler anywhere in the repo.

**Fix:** debounced `localStorage` autosave plus a `beforeunload` guard when the
draft differs from what was loaded.

### 2.12 No client context survives a nav click
`components/admin/AdminNav.tsx:7-16`

All eight nav items are global roots. Deep in a Smith field note, click
Messages, and you land on an empty Message Center. Every context switch is: nav
→ Clients → find the person → click the icon.

**Fix:** a real `/admin/clients/[clientId]` hub with tabs, and client-aware nav
that carries the current client through.

---

## 3. Accessibility

These also matter for a law firm: ADA exposure is real, and some clients use
assistive technology.

### 3.1 There is no keyboard path to uploading a document
`components/ui/FileDropzone.tsx:106, 115, 117-122, 126`

The drop target is a `<div onClick>` with no `role`, no `tabIndex`, no
`onKeyDown`. The inner "browse files" and "choose a folder" triggers are
`<span>` elements. The `<input type="file">` is `className="hidden"`, so
`display:none` removes it from the tab order too. A keyboard-only client cannot
upload a document at all.

### 3.2 The rich-text toolbar is entirely keyboard-inoperable
`components/ui/RichTextEditor.tsx:121-124, 148-151, 154-157, 170-180`

All eighteen buttons are wired with `onMouseDown` and no `onClick`. Tab to Bold,
press Enter, nothing happens — a `click` event fires and nothing listens for it.

**Fix:** keep `onMouseDown` for selection preservation, add `onClick`.

### 3.3 The upload modal is not a dialog
`components/messages/UploadDocsButton.tsx:81-107`

A plain `<div>`: no `role="dialog"`, no `aria-modal`, no focus trap, no Escape
handler, no focus restore. Tab walks straight out of the modal into the page
behind it.

### 3.4 Icon-only buttons with no accessible name
`RichTextEditor.tsx:148-151, 156-157, 171` (`⫷ ☰ ⫸ ▤ ⇤ ⇥ ⛌`),
`MessageCenter.tsx:423, 431`, `UploadDocsButton.tsx:85`.

A screen reader announces "⫸ button" or nothing. The correct pattern is already
used at `OutstandingTasks.tsx:71`.

### 3.5 Sortable table headers are not buttons
`PleadingsTable.tsx:75-84`, `DiscoveryTable.tsx:73-83`

`<th onClick>` with no `<button>`, no `tabIndex`, no `aria-sort`. Sorting the
pleadings docket is mouse-only.

### 3.6 Form inputs rely on placeholders instead of labels
Twelve inputs including the login email field (`app/(auth)/login/page.tsx:72-79`)
— the single most important input in the product — and both message composers.

---

## 4. Consistency

Not urgent, but this is what makes software feel homemade.

- **Fourteen distinct button styles** for three semantic roles. The Messages
  page alone shows a blue `rounded-xl` primary, an orange `#EA580C` primary that
  appears nowhere else in the product, and a gray outline `rounded-full` — all
  within one 40px header bar (`ClientThread.tsx:135` beside `:176`).
- **Two date formats on the same screen.** `TasksClient.tsx:180` renders
  `8/18/2026` while `:109` in the same component renders `Aug 18, 2026`. They
  appear one above the other on the Tasks page.
- **Timezone pinned in 8 places, omitted in ~30.** A client travelling to
  Pacific time sees court dates shift by a day relative to the "Overdue" badge,
  which *is* pinned to Eastern (`TasksClient.tsx:105`).
- **Brand navy hardcoded 43 times across 26 files** in three different casings,
  with three separate local palette definitions (`CalendarClient.tsx:12`,
  `AdminNav.tsx:29-32`, `app/(admin)/layout.tsx:26`). Any rebrand touches 26
  files.
- **227 `rounded-*` classes** across five different radii with no evident rule.
- Three dead components with zero imports: `DemoVideo.tsx`, `StatusLane.tsx`,
  `TaskCard.tsx`.

---

## Suggested order of work

**First pass — small effort, large payoff**

1. Per-client drafts in the admin composer (0.1)
2. Delete or gate `/mockups` (0.2)
3. Add the six database indexes (1.3)
4. Cache the Airtable client roster (1.4)
5. Fix the unread badge (2.3)
6. Auto-refresh the Message Center (2.4)
7. Error/not-found/loading pages (2.6)
8. Move the calendar's AI formatting off the render path (1.2)

**Second pass — the "clunky" feeling itself**

9. Mobile layout: sidebar, thread height, tables (2.1)
10. Error handling everywhere: no more empty-state-on-failure (0.3, 2.7, 2.8)
11. Confirmation that file uploads arrived (2.2)
12. Flatten the client layout waterfall (1.1)

**Third pass — foundations**

13. Shared `Button`, `ConfirmDialog`, `Toast` in `components/ui/` (2.9, 4)
14. Keyboard and screen-reader access (3.1-3.6)
15. Draft autosave and undo (2.10, 2.11)
16. Per-client admin hub (2.12)
