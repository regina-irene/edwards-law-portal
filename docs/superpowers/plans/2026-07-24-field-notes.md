# Field Notes (Part 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** An admin-only, per-client running case log at `/admin/notes` that merges Regina's typed rich-text notes with live portal events (messages, uploads, form updates, task completions).

**Architecture:** Manual notes live in a new `client_notes` Postgres table (sanitized HTML + a plain-text shadow for search). Portal events are **queried live** from existing tables at render — nothing is copied, so nothing drifts. A pure `mergeTimeline` function interleaves both, newest first. Server components fetch; one client component (`NotesTimeline`) handles the composer, edit/delete, and the Everything/Just-my-notes filter.

**Tech Stack:** Next.js 16.2.1 App Router, React 19, @vercel/postgres (`sql` tag from `@/lib/db`), Tailwind v4, Jest 30 + @testing-library (jsdom), existing `RichTextEditor`/`RichTextView` + `lib/sanitize.ts`.

## Global Constraints

- **Read `node_modules/next/dist/docs/` before writing Next.js code** — this version has breaking changes vs. training data (per AGENTS.md).
- Windows machine; Git Bash-compatible commands. Working dir `C:\Users\regin\portal`, branch created from `main`.
- **Admin-only, always:** every new route/API calls `requireAdmin()` from `@/lib/admin` (returns `{status: "ok", email}` | `{status:"unauthenticated"}` | `{status:"forbidden"}`). Nothing under `app/(client)` or any client-reachable API may expose notes.
- Client ids are normalized with `String(clientId)` everywhere (linked-record gotcha).
- Server-rendered dates/times pass `timeZone: "America/New_York"`.
- `npm test` baseline: suites `__tests__/api/chat.test.ts` and `__tests__/api/admin-chat.test.ts` FAIL (7 tests) — pre-existing, do not fix, do not worsen. `npx tsc --noEmit` has 8 pre-existing errors in `__tests__/api/{chat,messages,nav}.test.ts` — add none.
- DB migrations: append to `MIGRATION_SQL` in `scripts/migrate.ts` AND apply live via `node --env-file=.env.local -e "…pg Pool…"` against `POSTGRES_URL_NON_POOLING` (`npm run migrate` is broken).
- Never import `@/lib/resend` into a file a jsdom test loads without mocking it (the real package needs TextEncoder). Not expected in this plan; noted for safety.
- Commit style: conventional (`feat:`, `fix:`). Deploy (`npx vercel --prod --scope=edwardslaw`) happens ONLY in the final task.
- Spec: `docs/superpowers/specs/2026-07-17-thistle-facelift-and-field-notes-design.md` (Part 2). UI copy comes from there: hub empty state "No notes yet", timeline empty state "No notes yet — write the first one."

---

### Task 1: Database groundwork + task-completion timestamps

**Files:**
- Modify: `scripts/migrate.ts` (append to MIGRATION_SQL, after the `email_status` line)
- Modify: `app/api/tasks/route.ts:66-70` (PATCH sets/clears `completed_at`)
- Test: `__tests__/api/tasks-completed.test.ts` (new)

**Interfaces:**
- Produces: DB tables/columns used by Tasks 2-3: `client_notes(id UUID, client_id TEXT, body TEXT, body_text TEXT, created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ)` and `client_tasks.completed_at TIMESTAMPTZ` (set when a task flips to done, NULL when unchecked).

- [ ] **Step 1: Append to `MIGRATION_SQL` in `scripts/migrate.ts`** (directly after the `ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS email_status TEXT;` line):

```sql
  -- Field Notes (2026-07-24): admin-only per-client case log
  CREATE TABLE IF NOT EXISTS client_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id TEXT NOT NULL,
    body TEXT NOT NULL,
    body_text TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ
  );
  CREATE INDEX IF NOT EXISTS client_notes_client_idx ON client_notes (client_id, created_at DESC);
  ALTER TABLE client_tasks ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
```

- [ ] **Step 2: Apply live** (single statement batch; expect "field notes migration applied"):

```bash
node --env-file=.env.local -e "
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.POSTGRES_URL_NON_POOLING });
const SQL = \`
  CREATE TABLE IF NOT EXISTS client_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id TEXT NOT NULL,
    body TEXT NOT NULL,
    body_text TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ
  );
  CREATE INDEX IF NOT EXISTS client_notes_client_idx ON client_notes (client_id, created_at DESC);
  ALTER TABLE client_tasks ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
\`;
pool.query(SQL).then(() => { console.log('field notes migration applied'); return pool.end(); })
  .catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
"
```

- [ ] **Step 3: Write the failing test** `__tests__/api/tasks-completed.test.ts` (the sql mock captures the tagged-template strings so we can assert the UPDATE maintains `completed_at`):

```ts
import { PATCH } from "@/app/api/tasks/route"

jest.mock("@/auth", () => ({ auth: jest.fn() }))
jest.mock("@/lib/db", () => ({ sql: jest.fn() }))
jest.mock("@/lib/airtable", () => ({ getClientByEmail: jest.fn() }))
jest.mock("@/lib/portal-client", () => ({ getPortalClient: jest.fn() }))
jest.mock("@/lib/task-attachments", () => ({ getTemplateAttachments: jest.fn(), getClientTaskAttachments: jest.fn() }))

import { auth } from "@/auth"
import { sql } from "@/lib/db"
import { getClientByEmail } from "@/lib/airtable"

const mockAuth = auth as jest.Mock
const mockSql = sql as unknown as jest.Mock
const mockGetClient = getClientByEmail as jest.Mock

beforeEach(() => jest.clearAllMocks())

function patchReq(body: unknown): Request {
  return new Request("http://localhost/api/tasks", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

describe("PATCH /api/tasks completed_at", () => {
  it("stamps completed_at when marking done", async () => {
    mockAuth.mockResolvedValueOnce({ user: { email: "c@x.com" } })
    mockGetClient.mockResolvedValueOnce({ clientId: "rec123" })
    mockSql.mockResolvedValueOnce({ rows: [{ id: "t1", status: "done" }] })
    const res = await PATCH(patchReq({ id: "t1", status: "done" }))
    expect(res.status).toBe(200)
    const queryText = (mockSql.mock.calls[0][0] as TemplateStringsArray).join("?")
    expect(queryText).toContain("completed_at")
    expect(queryText).toMatch(/CASE WHEN .* THEN NOW\(\) ELSE NULL END/s)
  })
})
```

- [ ] **Step 4: Run it to verify it fails** — `npx jest __tests__/api/tasks-completed.test.ts` — Expected: FAIL, queryText does not contain "completed_at".

- [ ] **Step 5: Update the PATCH UPDATE statement** in `app/api/tasks/route.ts` (lines 66-70) to:

```ts
    const result = await sql`
      UPDATE client_tasks
      SET status = ${status as string},
          completed_at = CASE WHEN ${status as string} = 'done' THEN NOW() ELSE NULL END
      WHERE id = ${id} AND client_id = ${String(client.clientId)}
      RETURNING id, status
    `
```

- [ ] **Step 6: Run the test again** — `npx jest __tests__/api/tasks-completed.test.ts` — Expected: PASS. Then `npm test` — baseline failures only.

- [ ] **Step 7: Commit**

```bash
git add scripts/migrate.ts app/api/tasks/route.ts __tests__/api/tasks-completed.test.ts
git commit -m "feat: client_notes table + task completion timestamps"
```

---

### Task 2: Notes library (text helpers + CRUD)

**Files:**
- Create: `lib/notes.ts`
- Test: `__tests__/lib/notes.test.ts` (pure helpers only — DB functions are exercised via the API/pages)

**Interfaces:**
- Produces (Tasks 3-6 rely on these exact signatures):
  - `plainTextOf(html: string): string` — tags stripped, entities decoded (`&amp; &lt; &gt; &quot; &#39; &nbsp;`), whitespace collapsed
  - `snippetOf(html: string, max?: number): string` — plain text, default max 140 chars, `…` appended when truncated
  - `interface ClientNote { id: string; body: string; created_at: string; updated_at: string | null }`
  - `listNotes(clientId: string): Promise<ClientNote[]>` — newest first
  - `createNote(clientId: string, bodyHtml: string): Promise<ClientNote>` — sanitizes, derives body_text
  - `updateNote(id: string, bodyHtml: string): Promise<ClientNote | null>` — sanitizes, sets updated_at=NOW()
  - `deleteNote(id: string): Promise<boolean>`
  - `latestNoteByClient(): Promise<Map<string, { snippet: string; created_at: string }>>` — one entry per client with ≥1 note
  - `searchNotes(q: string): Promise<{ clientId: string; noteId: string; snippet: string; created_at: string }[]>` — ILIKE on body_text, newest first, LIMIT 50

- [ ] **Step 1: Write the failing test** `__tests__/lib/notes.test.ts`:

```ts
import { plainTextOf, snippetOf } from "@/lib/notes"

describe("plainTextOf", () => {
  it("strips tags, decodes entities, collapses whitespace", () => {
    expect(plainTextOf("<p>Called <b>client</b> re:&nbsp;mediation &amp; costs</p>\n<p>Follow up</p>"))
      .toBe("Called client re: mediation & costs Follow up")
  })
  it("returns empty string for empty/tag-only html", () => {
    expect(plainTextOf("<p><br></p>")).toBe("")
  })
})

describe("snippetOf", () => {
  it("passes short text through untruncated", () => {
    expect(snippetOf("<p>Short note</p>")).toBe("Short note")
  })
  it("truncates at the limit and appends an ellipsis", () => {
    const long = "<p>" + "word ".repeat(60) + "</p>"
    const s = snippetOf(long)
    expect(s.length).toBeLessThanOrEqual(141) // 140 + ellipsis char
    expect(s.endsWith("…")).toBe(true)
  })
})
```

- [ ] **Step 2: Run it to verify it fails** — `npx jest __tests__/lib/notes.test.ts` — Expected: FAIL, cannot find module.

- [ ] **Step 3: Create `lib/notes.ts`:**

```ts
// lib/notes.ts — Field Notes storage: Regina's private per-client case log.
// Admin-only by construction: only /api/admin/notes and /admin/notes pages
// import this. HTML is sanitized on write; body_text is a plain-text shadow
// kept in sync for search and snippets.
import { sql } from "@/lib/db"
import { sanitizeNotesHtml } from "@/lib/sanitize"

export interface ClientNote {
  id: string
  body: string
  created_at: string
  updated_at: string | null
}

export function plainTextOf(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/\s+/g, " ")
    .trim()
}

export function snippetOf(html: string, max = 140): string {
  const text = plainTextOf(html)
  return text.length <= max ? text : text.slice(0, max).trimEnd() + "…"
}

export async function listNotes(clientId: string): Promise<ClientNote[]> {
  const r = await sql`
    SELECT id, body, created_at, updated_at FROM client_notes
    WHERE client_id = ${String(clientId)}
    ORDER BY created_at DESC
  `
  return r.rows as ClientNote[]
}

export async function createNote(clientId: string, bodyHtml: string): Promise<ClientNote> {
  const body = sanitizeNotesHtml(bodyHtml)
  const r = await sql`
    INSERT INTO client_notes (client_id, body, body_text)
    VALUES (${String(clientId)}, ${body}, ${plainTextOf(body)})
    RETURNING id, body, created_at, updated_at
  `
  return r.rows[0] as ClientNote
}

export async function updateNote(id: string, bodyHtml: string): Promise<ClientNote | null> {
  const body = sanitizeNotesHtml(bodyHtml)
  const r = await sql`
    UPDATE client_notes
    SET body = ${body}, body_text = ${plainTextOf(body)}, updated_at = NOW()
    WHERE id = ${id}
    RETURNING id, body, created_at, updated_at
  `
  return (r.rows[0] as ClientNote) ?? null
}

export async function deleteNote(id: string): Promise<boolean> {
  const r = await sql`DELETE FROM client_notes WHERE id = ${id} RETURNING id`
  return r.rows.length > 0
}

export async function latestNoteByClient(): Promise<Map<string, { snippet: string; created_at: string }>> {
  const r = await sql`
    SELECT DISTINCT ON (client_id) client_id, body_text, created_at
    FROM client_notes
    ORDER BY client_id, created_at DESC
  `
  const map = new Map<string, { snippet: string; created_at: string }>()
  for (const row of r.rows) {
    const text = String(row.body_text ?? "")
    map.set(String(row.client_id), {
      snippet: text.length <= 140 ? text : text.slice(0, 140).trimEnd() + "…",
      created_at: String(row.created_at),
    })
  }
  return map
}

export async function searchNotes(q: string): Promise<{ clientId: string; noteId: string; snippet: string; created_at: string }[]> {
  const r = await sql`
    SELECT id, client_id, body_text, created_at FROM client_notes
    WHERE body_text ILIKE ${"%" + q + "%"}
    ORDER BY created_at DESC
    LIMIT 50
  `
  return r.rows.map((row) => {
    const text = String(row.body_text ?? "")
    return {
      clientId: String(row.client_id),
      noteId: String(row.id),
      snippet: text.length <= 140 ? text : text.slice(0, 140).trimEnd() + "…",
      created_at: String(row.created_at),
    }
  })
}
```

- [ ] **Step 4: Run the test** — `npx jest __tests__/lib/notes.test.ts` — Expected: PASS (4/4).

- [ ] **Step 5: Commit**

```bash
git add lib/notes.ts __tests__/lib/notes.test.ts
git commit -m "feat: notes library — text helpers + client_notes CRUD"
```

---

### Task 3: Timeline events + merge

**Files:**
- Create: `lib/notes-timeline.ts`
- Test: `__tests__/lib/notes-timeline.test.ts` (pure merge only)

**Interfaces:**
- Consumes: `ClientNote` from `@/lib/notes`.
- Produces:
  - `interface TimelineEvent { id: string; kind: "chat" | "message" | "upload" | "form" | "task"; at: string; sender?: "client" | "firm"; smsStatus?: string | null; detail: string }`
  - `type TimelineItem = { type: "note"; at: string; note: ClientNote } | { type: "event"; at: string; event: TimelineEvent }`
  - `mergeTimeline(notes: ClientNote[], events: TimelineEvent[]): TimelineItem[]` — pure; newest first by `at`, ties broken by id descending (stable)
  - `fetchClientEvents(clientId: string): Promise<TimelineEvent[]>` — each source fail-soft (a failing source is skipped, never throws)

- [ ] **Step 1: Write the failing test** `__tests__/lib/notes-timeline.test.ts`:

```ts
import { mergeTimeline, type TimelineEvent } from "@/lib/notes-timeline"
import type { ClientNote } from "@/lib/notes"

const note = (id: string, at: string): ClientNote => ({ id, body: "<p>n</p>", created_at: at, updated_at: null })
const event = (id: string, at: string): TimelineEvent => ({ id, kind: "chat", at, sender: "client", smsStatus: null, detail: "sent a message" })

describe("mergeTimeline", () => {
  it("interleaves notes and events newest-first", () => {
    const items = mergeTimeline(
      [note("n1", "2026-07-20T10:00:00Z"), note("n2", "2026-07-01T10:00:00Z")],
      [event("e1", "2026-07-10T10:00:00Z")]
    )
    expect(items.map((i) => i.type)).toEqual(["note", "event", "note"])
  })
  it("breaks timestamp ties deterministically (id descending)", () => {
    const a = mergeTimeline([note("n1", "2026-07-10T10:00:00Z")], [event("e9", "2026-07-10T10:00:00Z")])
    const b = mergeTimeline([note("n1", "2026-07-10T10:00:00Z")], [event("e9", "2026-07-10T10:00:00Z")])
    expect(a.map((i) => i.type)).toEqual(b.map((i) => i.type))
  })
  it("handles empty inputs", () => {
    expect(mergeTimeline([], [])).toEqual([])
  })
})
```

- [ ] **Step 2: Run it to verify it fails** — `npx jest __tests__/lib/notes-timeline.test.ts` — Expected: FAIL, cannot find module.

- [ ] **Step 3: Create `lib/notes-timeline.ts`:**

```ts
// lib/notes-timeline.ts — live portal events for a client's Field Notes
// timeline, merged with manual notes. Events are QUERIED at render from the
// tables that already record them — nothing is copied, nothing drifts.
// Every source is fail-soft: one broken source never blanks the timeline.
import { sql } from "@/lib/db"
import type { ClientNote } from "@/lib/notes"

export interface TimelineEvent {
  id: string
  kind: "chat" | "message" | "upload" | "form" | "task"
  at: string
  sender?: "client" | "firm"
  smsStatus?: string | null
  detail: string
}

export type TimelineItem =
  | { type: "note"; at: string; note: ClientNote }
  | { type: "event"; at: string; event: TimelineEvent }

export function mergeTimeline(notes: ClientNote[], events: TimelineEvent[]): TimelineItem[] {
  const items: TimelineItem[] = [
    ...notes.map((n): TimelineItem => ({ type: "note", at: String(n.created_at), note: n })),
    ...events.map((e): TimelineItem => ({ type: "event", at: String(e.at), event: e })),
  ]
  return items.sort((a, b) => {
    const t = new Date(b.at).getTime() - new Date(a.at).getTime()
    if (t !== 0) return t
    const ida = a.type === "note" ? a.note.id : a.event.id
    const idb = b.type === "note" ? b.note.id : b.event.id
    return idb.localeCompare(ida)
  })
}

const PER_SOURCE_LIMIT = 500

export async function fetchClientEvents(clientId: string): Promise<TimelineEvent[]> {
  const cid = String(clientId)
  const [chat, legacy, taskFiles, msgFiles, forms, doneTasks] = await Promise.all([
    sql`SELECT id, sender, body, sms_status, created_at FROM chat_messages
        WHERE client_id = ${cid} ORDER BY created_at DESC LIMIT ${PER_SOURCE_LIMIT}`.catch(() => ({ rows: [] as any[] })),
    sql`SELECT id, body, created_at FROM messages
        WHERE client_id = ${cid} ORDER BY created_at DESC LIMIT ${PER_SOURCE_LIMIT}`.catch(() => ({ rows: [] as any[] })),
    sql`SELECT id, file_name, created_at FROM task_attachments
        WHERE client_id = ${cid} AND scope = 'client_task'
        ORDER BY created_at DESC LIMIT ${PER_SOURCE_LIMIT}`.catch(() => ({ rows: [] as any[] })),
    sql`SELECT ma.id, ma.file_name, ma.created_at, cm.sender
        FROM message_attachments ma JOIN chat_messages cm ON cm.id = ma.message_id
        WHERE cm.client_id = ${cid}
        ORDER BY ma.created_at DESC LIMIT ${PER_SOURCE_LIMIT}`.catch(() => ({ rows: [] as any[] })),
    sql`SELECT form_key, MAX(updated_at) AS updated_at, COUNT(*) AS answers
        FROM form_responses WHERE client_id = ${cid}
        GROUP BY form_key ORDER BY MAX(updated_at) DESC`.catch(() => ({ rows: [] as any[] })),
    sql`SELECT id, title, completed_at FROM client_tasks
        WHERE client_id = ${cid} AND status = 'done' AND completed_at IS NOT NULL
        ORDER BY completed_at DESC LIMIT ${PER_SOURCE_LIMIT}`.catch(() => ({ rows: [] as any[] })),
  ])

  const events: TimelineEvent[] = []
  for (const m of chat.rows) {
    const preview = String(m.body ?? "").slice(0, 120)
    events.push({
      id: `chat-${m.id}`,
      kind: "chat",
      at: String(m.created_at),
      sender: m.sender === "firm" ? "firm" : "client",
      smsStatus: m.sms_status ?? null,
      detail:
        m.sender === "firm"
          ? `You sent a message: “${preview}”`
          : m.sms_status === "inbound"
            ? `Client texted: “${preview}”`
            : `Client sent a message: “${preview}”`,
    })
  }
  for (const m of legacy.rows) {
    events.push({ id: `message-${m.id}`, kind: "message", at: String(m.created_at), sender: "firm", detail: `You sent a message: “${String(m.body ?? "").slice(0, 120)}”` })
  }
  for (const f of taskFiles.rows) {
    events.push({ id: `upload-${f.id}`, kind: "upload", at: String(f.created_at), sender: "client", detail: `Client uploaded ${f.file_name}` })
  }
  for (const f of msgFiles.rows) {
    const who = f.sender === "firm" ? "You" : "Client"
    events.push({ id: `msgfile-${f.id}`, kind: "upload", at: String(f.created_at), sender: f.sender === "firm" ? "firm" : "client", detail: `${who} attached ${f.file_name}` })
  }
  for (const f of forms.rows) {
    events.push({ id: `form-${f.form_key}`, kind: "form", at: String(f.updated_at), sender: "client", detail: `Client updated the ${String(f.form_key).replace(/-/g, " ")} form (${f.answers} answers)` })
  }
  for (const t of doneTasks.rows) {
    events.push({ id: `task-${t.id}`, kind: "task", at: String(t.completed_at), sender: "client", detail: `Task completed: ${t.title}` })
  }
  return events
}
```

- [ ] **Step 4: Run the test** — `npx jest __tests__/lib/notes-timeline.test.ts` — Expected: PASS (3/3).

- [ ] **Step 5: Verify schema assumptions** — confirm `task_attachments` has a `client_id` column and `message_attachments` has `message_id`/`file_name`/`created_at`: `grep -n -A 12 "CREATE TABLE IF NOT EXISTS task_attachments\|CREATE TABLE IF NOT EXISTS message_attachments" scripts/migrate.ts`. If a column differs, adjust the query to match the real schema (and say so in your report).

- [ ] **Step 6: Commit**

```bash
git add lib/notes-timeline.ts __tests__/lib/notes-timeline.test.ts
git commit -m "feat: field notes timeline — live event fetch + pure merge"
```

---

### Task 4: Admin notes API

**Files:**
- Create: `app/api/admin/notes/route.ts`
- Test: `__tests__/api/admin-notes.test.ts`

**Interfaces:**
- Consumes: `listNotes/createNote/updateNote/deleteNote` from `@/lib/notes` (Task 2).
- Produces: `GET /api/admin/notes?clientId=X` → `{notes: ClientNote[]}`; `POST {clientId, body}` → `{note}` 201; `PATCH {id, body}` → `{note}`; `DELETE ?id=X` → `{ok:true}`. All 401 unauthenticated / 403 non-admin / 400 bad input.

- [ ] **Step 1: Write the failing test** `__tests__/api/admin-notes.test.ts`:

```ts
import { GET, POST, PATCH, DELETE } from "@/app/api/admin/notes/route"

jest.mock("@/lib/admin", () => ({ requireAdmin: jest.fn() }))
jest.mock("@/lib/notes", () => ({
  listNotes: jest.fn(),
  createNote: jest.fn(),
  updateNote: jest.fn(),
  deleteNote: jest.fn(),
}))

import { requireAdmin } from "@/lib/admin"
import { listNotes, createNote } from "@/lib/notes"

const mockAdmin = requireAdmin as jest.Mock
const mockList = listNotes as jest.Mock
const mockCreate = createNote as jest.Mock

beforeEach(() => jest.clearAllMocks())

describe("/api/admin/notes", () => {
  it("GET returns 403 for non-admin", async () => {
    mockAdmin.mockResolvedValueOnce({ status: "forbidden" })
    const res = await GET(new Request("http://x/api/admin/notes?clientId=rec1"))
    expect(res.status).toBe(403)
  })

  it("GET lists notes for a client", async () => {
    mockAdmin.mockResolvedValueOnce({ status: "ok", email: "a@b.c" })
    mockList.mockResolvedValueOnce([{ id: "n1", body: "<p>x</p>", created_at: "2026-07-24", updated_at: null }])
    const res = await GET(new Request("http://x/api/admin/notes?clientId=rec1"))
    expect(res.status).toBe(200)
    expect((await res.json()).notes).toHaveLength(1)
  })

  it("POST creates a note", async () => {
    mockAdmin.mockResolvedValueOnce({ status: "ok", email: "a@b.c" })
    mockCreate.mockResolvedValueOnce({ id: "n1", body: "<p>x</p>", created_at: "2026-07-24", updated_at: null })
    const res = await POST(new Request("http://x/api/admin/notes", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId: "rec1", body: "<p>x</p>" }),
    }))
    expect(res.status).toBe(201)
    expect(mockCreate).toHaveBeenCalledWith("rec1", "<p>x</p>")
  })

  it("POST rejects empty body", async () => {
    mockAdmin.mockResolvedValueOnce({ status: "ok", email: "a@b.c" })
    const res = await POST(new Request("http://x/api/admin/notes", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId: "rec1", body: "   " }),
    }))
    expect(res.status).toBe(400)
  })
})
```

- [ ] **Step 2: Run it to verify it fails** — `npx jest __tests__/api/admin-notes.test.ts` — Expected: FAIL, cannot find module.

- [ ] **Step 3: Create `app/api/admin/notes/route.ts`:**

```ts
// app/api/admin/notes/route.ts — Field Notes CRUD. ADMIN ONLY: notes are the
// firm's private case log; no client-facing route may ever serve them.
import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin"
import { listNotes, createNote, updateNote, deleteNote } from "@/lib/notes"

async function gate() {
  const check = await requireAdmin()
  if (check.status === "unauthenticated") return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (check.status === "forbidden") return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  return null
}

export async function GET(req: Request) {
  const denied = await gate()
  if (denied) return denied
  const clientId = new URL(req.url).searchParams.get("clientId")
  if (!clientId) return NextResponse.json({ error: "clientId required" }, { status: 400 })
  try {
    return NextResponse.json({ notes: await listNotes(clientId) })
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(req: Request) {
  const denied = await gate()
  if (denied) return denied
  const parsed = await req.json().catch(() => null)
  const clientId = typeof parsed?.clientId === "string" ? parsed.clientId : ""
  const body = typeof parsed?.body === "string" ? parsed.body : ""
  if (!clientId || !body.trim()) return NextResponse.json({ error: "clientId and body required" }, { status: 400 })
  try {
    return NextResponse.json({ note: await createNote(clientId, body) }, { status: 201 })
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function PATCH(req: Request) {
  const denied = await gate()
  if (denied) return denied
  const parsed = await req.json().catch(() => null)
  const id = typeof parsed?.id === "string" ? parsed.id : ""
  const body = typeof parsed?.body === "string" ? parsed.body : ""
  if (!id || !body.trim()) return NextResponse.json({ error: "id and body required" }, { status: 400 })
  try {
    const note = await updateNote(id, body)
    if (!note) return NextResponse.json({ error: "Not found" }, { status: 404 })
    return NextResponse.json({ note })
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  const denied = await gate()
  if (denied) return denied
  const id = new URL(req.url).searchParams.get("id")
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 })
  try {
    const ok = await deleteNote(id)
    if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
```

- [ ] **Step 4: Run the test** — `npx jest __tests__/api/admin-notes.test.ts` — Expected: PASS (4/4). Then `npm test` — baseline failures only.

- [ ] **Step 5: Commit**

```bash
git add app/api/admin/notes/route.ts __tests__/api/admin-notes.test.ts
git commit -m "feat: admin-only Field Notes API"
```

---

### Task 5: Hub page, nav entry, client-row shortcut

**Files:**
- Create: `app/(admin)/admin/notes/page.tsx`
- Modify: `components/admin/AdminNav.tsx:7-14` (ITEMS), `lib/taglines.ts` (add `"admin:notes"`), `app/(admin)/admin/clients/page.tsx` (📝 row button)

**Interfaces:**
- Consumes: `latestNoteByClient`, `searchNotes` (Task 2); `PageTitle` (`{title, tagline?, actions?}`); `taglineFor(key)`; `fetchAllClientsRaw`, `clientDisplayLabel` from `@/lib/airtable`; `getClientLabels` from `@/lib/client-labels`.
- Produces: hub route `/admin/notes` with optional `?q=` search; per-client route links `/admin/notes/<clientId>` (Task 6 implements that page).

- [ ] **Step 1: Add the nav item** in `components/admin/AdminNav.tsx` ITEMS, between Tasks and Pages:

```ts
  { href: "/admin/notes", label: "Field Notes", icon: "📝", match: (p: string) => p.startsWith("/admin/notes") },
```

- [ ] **Step 2: Add the tagline** in `lib/taglines.ts`, after `"admin:tasks"`:

```ts
  "admin:notes": "Your private case log — clients never see this",
```

- [ ] **Step 3: Create `app/(admin)/admin/notes/page.tsx`:**

```tsx
// app/(admin)/admin/notes/page.tsx — Field Notes hub: every client A→Z with
// their latest note, plus search across all notes. Admin layout gates auth;
// notes themselves are served only through admin-only code paths.
import Link from "next/link"
import PageTitle from "@/components/ui/PageTitle"
import { taglineFor } from "@/lib/taglines"
import { fetchAllClientsRaw, clientDisplayLabel } from "@/lib/airtable"
import { getClientLabels } from "@/lib/client-labels"
import { latestNoteByClient, searchNotes } from "@/lib/notes"

export const dynamic = "force-dynamic"

function fmtDate(d: string): string {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "America/New_York" })
}

export default async function FieldNotesHub({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams
  const query = (q ?? "").trim()

  const [clients, labels, latest, results] = await Promise.all([
    fetchAllClientsRaw().catch(() => []),
    getClientLabels().catch(() => ({}) as Record<string, string>),
    latestNoteByClient().catch(() => new Map<string, { snippet: string; created_at: string }>()),
    query ? searchNotes(query).catch(() => []) : Promise.resolve([]),
  ])

  const labelOf = (id: string, fallbackName?: string) =>
    labels[id] || (fallbackName ? clientDisplayLabel(fallbackName) : "") || id

  const rows = clients
    .filter((c) => c.clientId)
    .map((c) => ({ id: String(c.clientId), label: labelOf(String(c.clientId), c.name) }))
    .sort((a, b) => a.label.localeCompare(b.label))

  return (
    <div className="space-y-6 max-w-3xl">
      <PageTitle title="Field Notes" tagline={taglineFor("admin:notes")} />

      <form method="GET" action="/admin/notes">
        <input
          type="search"
          name="q"
          defaultValue={query}
          placeholder="Search every note…"
          className="w-full px-4 py-2.5 text-sm bg-white border border-gray-300 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </form>

      {query && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
          <p className="section-label">Search results for “{query}”</p>
          {results.length === 0 && <p className="text-sm text-gray-500">No notes match.</p>}
          {results.map((r) => (
            <Link key={r.noteId} href={`/admin/notes/${encodeURIComponent(r.clientId)}`} className="block hover:bg-gray-50 rounded-lg p-2 -m-2">
              <p className="text-sm font-semibold text-gray-900">{labelOf(r.clientId)} <span className="font-normal text-gray-400">· {fmtDate(r.created_at)}</span></p>
              <p className="text-sm text-gray-600">{r.snippet}</p>
            </Link>
          ))}
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
        {rows.map((r) => {
          const note = latest.get(r.id)
          return (
            <Link key={r.id} href={`/admin/notes/${encodeURIComponent(r.id)}`} className="flex items-baseline justify-between gap-4 px-5 py-3.5 hover:bg-gray-50">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-900">{r.label}</p>
                <p className="text-sm text-gray-500 truncate">{note ? note.snippet : "No notes yet"}</p>
              </div>
              {note && <span className="shrink-0 text-xs text-gray-400">{fmtDate(note.created_at)}</span>}
            </Link>
          )
        })}
        {rows.length === 0 && <p className="px-5 py-6 text-sm text-gray-500">No clients found (Airtable may be unreachable) — try again shortly.</p>}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Add the 📝 row button** on `app/(admin)/admin/clients/page.tsx`: find the row of icon-over-label action links (🔗 Airtable / ✉️ Invite / 💬 Messages / 📄 Pages / 👁️ Preview). Add a "Notes" link BEFORE the Messages button, copying the Messages link's exact classes/structure, with icon 📝, label "Notes", and `href={`/admin/notes/${encodeURIComponent(String(c.clientId))}`}` (match however the surrounding buttons reference the client id variable in scope).

- [ ] **Step 5: Verify** — `npx tsc --noEmit 2>&1 | grep -v "__tests__/api"` shows no new errors; `npm test` baseline-only.

- [ ] **Step 6: Commit**

```bash
git add "app/(admin)/admin/notes" components/admin/AdminNav.tsx lib/taglines.ts "app/(admin)/admin/clients/page.tsx"
git commit -m "feat: Field Notes hub page, admin nav entry, client-row shortcut"
```

---

### Task 6: Client timeline page + composer

**Files:**
- Create: `app/(admin)/admin/notes/[clientId]/page.tsx`, `components/notes/NotesTimeline.tsx`
- Test: `__tests__/components/notes/NotesTimeline.test.tsx`

**Interfaces:**
- Consumes: `listNotes`, `snippetOf`, `ClientNote` (Task 2); `fetchClientEvents`, `mergeTimeline`, `TimelineEvent`, `TimelineItem` (Task 3); API routes (Task 4); `RichTextEditor`/`RichTextView` (`{value, onChange}` / `{html, className?}`); `PrintButton` (`{label?}`); `PageTitle`.
- Produces: route `/admin/notes/[clientId]`.

- [ ] **Step 1: Write the failing test** `__tests__/components/notes/NotesTimeline.test.tsx` (RichTextEditor uses contentEditable — mock it to keep jsdom simple):

```tsx
import { render, screen, fireEvent } from "@testing-library/react"
import "@testing-library/jest-dom"
import NotesTimeline from "@/components/notes/NotesTimeline"
import type { TimelineItem } from "@/lib/notes-timeline"

jest.mock("@/components/ui/RichTextEditor", () => ({
  RichTextEditor: ({ value, onChange }: { value: string; onChange: (h: string) => void }) => (
    <textarea data-testid="editor" value={value} onChange={(e) => onChange(e.target.value)} />
  ),
  RichTextView: ({ html }: { html: string }) => <div data-testid="view">{html}</div>,
}))

const items: TimelineItem[] = [
  { type: "note", at: "2026-07-24T10:00:00Z", note: { id: "n1", body: "<p>Strategy call</p>", created_at: "2026-07-24T10:00:00Z", updated_at: null } },
  { type: "event", at: "2026-07-23T10:00:00Z", event: { id: "e1", kind: "upload", at: "2026-07-23T10:00:00Z", sender: "client", detail: "Client uploaded W2.pdf" } },
]

describe("NotesTimeline", () => {
  it("renders notes and events", () => {
    render(<NotesTimeline clientId="rec1" initialItems={items} />)
    expect(screen.getByTestId("view")).toHaveTextContent("Strategy call")
    expect(screen.getByText(/Client uploaded W2.pdf/)).toBeInTheDocument()
  })

  it("'Just my notes' filter hides events", () => {
    render(<NotesTimeline clientId="rec1" initialItems={items} />)
    fireEvent.click(screen.getByRole("button", { name: /just my notes/i }))
    expect(screen.queryByText(/Client uploaded W2.pdf/)).not.toBeInTheDocument()
    expect(screen.getByTestId("view")).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run it to verify it fails** — `npx jest __tests__/components/notes/NotesTimeline.test.tsx` — Expected: FAIL, cannot find module.

- [ ] **Step 3: Create `components/notes/NotesTimeline.tsx`:**

```tsx
"use client"
// components/notes/NotesTimeline.tsx — composer + merged timeline for one
// client's Field Notes. Manual notes are white cards with a navy edge (the
// "important" entries); portal events are lighter compact rows. Newest first.
import { useState } from "react"
import { RichTextEditor, RichTextView } from "@/components/ui/RichTextEditor"
import type { TimelineItem } from "@/lib/notes-timeline"
import type { ClientNote } from "@/lib/notes"

const EVENT_ICONS: Record<string, string> = { chat: "💬", message: "💬", upload: "📎", form: "📋", task: "✅" }
const PAGE = 200

function fmt(at: string): string {
  return new Date(at).toLocaleString("en-US", {
    timeZone: "America/New_York",
    month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit",
  })
}

export default function NotesTimeline({ clientId, initialItems }: { clientId: string; initialItems: TimelineItem[] }) {
  const [items, setItems] = useState<TimelineItem[]>(initialItems)
  const [draft, setDraft] = useState("")
  const [saving, setSaving] = useState(false)
  const [notesOnly, setNotesOnly] = useState(false)
  const [shown, setShown] = useState(PAGE)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState("")
  const [error, setError] = useState("")

  async function save() {
    if (!draft.replace(/<[^>]*>/g, "").trim()) return
    setSaving(true)
    setError("")
    const res = await fetch("/api/admin/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId, body: draft }),
    }).catch(() => null)
    setSaving(false)
    if (!res?.ok) { setError("Couldn't save the note — try again."); return }
    const { note } = (await res.json()) as { note: ClientNote }
    setItems([{ type: "note", at: note.created_at, note }, ...items])
    setDraft("")
  }

  async function saveEdit(id: string) {
    const res = await fetch("/api/admin/notes", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, body: editDraft }),
    }).catch(() => null)
    if (!res?.ok) { setError("Couldn't update the note — try again."); return }
    const { note } = (await res.json()) as { note: ClientNote }
    setItems(items.map((i) => (i.type === "note" && i.note.id === id ? { ...i, note } : i)))
    setEditingId(null)
  }

  async function remove(id: string) {
    if (!window.confirm("Delete this note? This can't be undone.")) return
    const res = await fetch(`/api/admin/notes?id=${encodeURIComponent(id)}`, { method: "DELETE" }).catch(() => null)
    if (!res?.ok) { setError("Couldn't delete the note — try again.") ; return }
    setItems(items.filter((i) => !(i.type === "note" && i.note.id === id)))
  }

  const visible = notesOnly ? items.filter((i) => i.type === "note") : items
  const paged = visible.slice(0, shown)

  return (
    <div className="space-y-5 max-w-3xl">
      <div className="bg-white rounded-xl border border-gray-200 p-4 print:hidden">
        <p className="section-label mb-2">New note</p>
        <RichTextEditor value={draft} onChange={setDraft} />
        <div className="mt-3 flex items-center gap-3">
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="px-5 py-2 rounded-lg text-white text-sm font-semibold hover:opacity-90 disabled:opacity-60"
            style={{ background: "#1b2d45" }}
          >
            {saving ? "Saving…" : "Save note"}
          </button>
          {error && <span className="text-sm text-red-600">{error}</span>}
        </div>
      </div>

      <div className="flex items-center gap-2 print:hidden">
        <button
          type="button"
          onClick={() => setNotesOnly(false)}
          className={`px-3.5 py-1.5 rounded-full text-xs font-semibold border ${!notesOnly ? "text-white border-transparent" : "bg-white text-gray-700 border-gray-300"}`}
          style={!notesOnly ? { background: "#1b2d45" } : undefined}
        >
          Everything
        </button>
        <button
          type="button"
          onClick={() => setNotesOnly(true)}
          className={`px-3.5 py-1.5 rounded-full text-xs font-semibold border ${notesOnly ? "text-white border-transparent" : "bg-white text-gray-700 border-gray-300"}`}
          style={notesOnly ? { background: "#1b2d45" } : undefined}
        >
          Just my notes
        </button>
      </div>

      {paged.length === 0 && (
        <p className="text-sm text-gray-500 bg-white rounded-xl border border-gray-200 p-6">No notes yet — write the first one.</p>
      )}

      <div className="space-y-3">
        {paged.map((item) =>
          item.type === "note" ? (
            <div key={item.note.id} className="bg-white rounded-xl border border-gray-200 p-4" style={{ borderLeft: "4px solid #1b2d45" }}>
              <div className="flex items-center justify-between gap-3 mb-1.5">
                <p className="text-xs font-semibold" style={{ color: "#1b2d45" }}>
                  📌 {fmt(item.at)}{item.note.updated_at && <span className="font-normal text-gray-400"> · edited</span>}
                </p>
                <span className="flex gap-2 print:hidden">
                  <button type="button" className="text-xs text-gray-400 hover:text-gray-700 underline" onClick={() => { setEditingId(item.note.id); setEditDraft(item.note.body) }}>Edit</button>
                  <button type="button" className="text-xs text-gray-400 hover:text-red-600 underline" onClick={() => remove(item.note.id)}>Delete</button>
                </span>
              </div>
              {editingId === item.note.id ? (
                <div>
                  <RichTextEditor value={editDraft} onChange={setEditDraft} />
                  <div className="mt-2 flex gap-2">
                    <button type="button" className="px-3 py-1.5 rounded-lg text-white text-xs font-semibold" style={{ background: "#1b2d45" }} onClick={() => saveEdit(item.note.id)}>Save</button>
                    <button type="button" className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white border border-gray-300 text-gray-700" onClick={() => setEditingId(null)}>Cancel</button>
                  </div>
                </div>
              ) : (
                <RichTextView html={item.note.body} />
              )}
            </div>
          ) : (
            <div key={item.event.id} className="flex items-baseline gap-2.5 px-4 py-2 rounded-lg" style={{ background: "rgba(255,255,255,0.55)" }}>
              <span className="text-sm">{EVENT_ICONS[item.event.kind] ?? "•"}</span>
              <p className="text-[13px] text-gray-600 min-w-0">
                {item.event.detail}
                <span className="text-gray-400"> · {fmt(item.at)}</span>
              </p>
            </div>
          )
        )}
      </div>

      {visible.length > shown && (
        <button type="button" onClick={() => setShown(shown + PAGE)} className="print:hidden text-sm underline text-gray-600 hover:text-gray-900">
          Show older
        </button>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run the component test** — `npx jest __tests__/components/notes/NotesTimeline.test.tsx` — Expected: PASS (2/2).

- [ ] **Step 5: Create `app/(admin)/admin/notes/[clientId]/page.tsx`:**

```tsx
// app/(admin)/admin/notes/[clientId]/page.tsx — one client's Field Notes
// timeline: manual notes merged with live portal events, newest first.
import Link from "next/link"
import PageTitle from "@/components/ui/PageTitle"
import PrintButton from "@/components/ui/PrintButton"
import NotesTimeline from "@/components/notes/NotesTimeline"
import { fetchAllClientsRaw, clientDisplayLabel } from "@/lib/airtable"
import { getClientLabels } from "@/lib/client-labels"
import { listNotes } from "@/lib/notes"
import { fetchClientEvents, mergeTimeline } from "@/lib/notes-timeline"

export const dynamic = "force-dynamic"

export default async function ClientFieldNotes({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = await params
  const cid = decodeURIComponent(clientId)

  const [notes, events, clients, labels] = await Promise.all([
    listNotes(cid).catch(() => []),
    fetchClientEvents(cid),
    fetchAllClientsRaw().catch(() => []),
    getClientLabels().catch(() => ({}) as Record<string, string>),
  ])

  const client = clients.find((c) => String(c.clientId) === cid)
  const label = labels[cid] || (client ? clientDisplayLabel(client.name) : cid)
  const items = mergeTimeline(notes, events)

  return (
    <div className="space-y-6">
      <PageTitle
        title={label}
        tagline="Field Notes — your private case log; clients never see this"
        actions={
          <span className="flex items-center gap-3 print:hidden">
            <Link href="/admin/notes" className="text-sm underline text-gray-500 hover:text-gray-900">← All clients</Link>
            <PrintButton />
          </span>
        }
      />
      <NotesTimeline clientId={cid} initialItems={items} />
    </div>
  )
}
```

- [ ] **Step 6: Verify** — `npx tsc --noEmit 2>&1 | grep -v "__tests__/api"` no new errors; `npm test` baseline-only failures.

- [ ] **Step 7: Commit**

```bash
git add "app/(admin)/admin/notes" components/notes __tests__/components/notes
git commit -m "feat: Field Notes client timeline — composer, filter, print"
```

---

### Task 7: Build, deploy, memory

- [ ] **Step 1:** `npm run build` — compiles clean.
- [ ] **Step 2:** `npm test` — baseline failures only (chat, admin-chat).
- [ ] **Step 3:** Merge the work branch to `main` (`git checkout main && git merge --no-ff <branch>`), deploy `npx vercel --prod --scope=edwardslaw`, confirm `● Ready` via `npx vercel ls edwards-law-portal --scope=edwardslaw`.
- [ ] **Step 4:** Smoke-check with curl: `https://clients.edwardsfamilylaw.com/admin/notes` → 307 to login (auth gate works); `/api/admin/notes?clientId=x` unauthenticated → 401.
- [ ] **Step 5:** Update the memory file's Part-2 entry (feature now BUILT: routes, tables, gotchas learned) and tell Regina how to use it.

---

## Self-Review Notes

- Spec coverage: hub with A→Z labels + snippets + search (Task 5); timeline with composer/edit/delete/"edited" marker (Tasks 4+6); auto events chat both senders + SMS variants, legacy messages, both attachment tables, form updates (grouped per form — one row per field would flood the log), task completions via new completed_at (Tasks 1+3); Everything/Just-my-notes filter + 200-cap with Show older (Task 6 — client-side paging over server-fetched, per-source-capped data; satisfies the spec's intent without an extra API); Print (Task 6); admin-only privacy (Task 4 gate + admin layout; no client-side route touches lib/notes); fail-soft everywhere; empty states verbatim from spec.
- Pre-deploy note for Regina (carried to Task 7): tasks completed before today have no timestamp and won't appear in timelines — by design, flagged in the spec.
- Type consistency checked: `ClientNote`, `TimelineEvent`, `TimelineItem`, `snippetOf`, route param shapes (`searchParams`/`params` are Promises in Next 16 — both pages await them).
- `latestNoteByClient`/`searchNotes` duplicate the 140-char snippet logic in SQL-result space rather than calling `snippetOf` (body_text is already plain text — `snippetOf` expects HTML; acceptable, kept local).
