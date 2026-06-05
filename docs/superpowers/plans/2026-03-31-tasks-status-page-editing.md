# Tasks, Status Page, and Per-Client Page Editing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Tasks and Status pages for clients, admin task template management with client assignment, per-client page content editing (headers + announcements), and a Status View Link in Airtable.

**Architecture:** Three new PostgreSQL tables (task_templates, client_tasks, page_content) store portal tasks and per-client page customizations. Admin UI at /admin/tasks manages task templates and assigns them to clients. Admin UI at /admin/clients/[clientId]/pages edits headers and announcements per client per page. All client pages fetch their page_content from the DB and render it above existing content. Status page embeds an Airtable view using a new statusViewLink field from the Clients table. Follows all existing patterns: server components, @vercel/postgres sql tags, requireAdmin() guard for admin routes, auth() for client routes.

**Tech Stack:** Next.js 16 App Router, @vercel/postgres (sql tagged template), TypeScript, Tailwind CSS

---

## File Map

**Create:**
- `app/(client)/status/page.tsx` — embeds client's status Airtable view
- `app/(client)/tasks/page.tsx` — lists portal tasks assigned to client
- `app/api/tasks/route.ts` — GET tasks for current client
- `app/(admin)/admin/tasks/page.tsx` — admin: manage templates + assign to clients
- `app/api/admin/tasks/route.ts` — admin: CRUD templates + assign tasks
- `app/(admin)/admin/clients/[clientId]/pages/page.tsx` — admin: edit page content per client
- `app/api/admin/page-content/route.ts` — GET/PUT page_content per client+page

**Modify:**
- `scripts/migrate.ts` — add task_templates, client_tasks, page_content tables
- `lib/airtable.ts` — add statusViewLink field to AirtableClient + getAllClients
- `app/(client)/layout.tsx` — add "status" and "tasks" to DEFAULT_PAGES
- `app/(admin)/layout.tsx` — add Tasks + Pages links to admin nav
- `app/(admin)/admin/page.tsx` — pull clients from Airtable, add Pages + Tasks links
- `app/(client)/dashboard/page.tsx` — render page_content header + announcement
- `app/(client)/pleadings/page.tsx` — render page_content header + announcement
- `app/(client)/discovery/page.tsx` — render page_content header + announcement
- `app/(client)/calendar/page.tsx` — render page_content header + announcement
- `app/(client)/document-requests/page.tsx` — render page_content header + announcement
- `app/(client)/messages/page.tsx` — render page_content header + announcement
- `app/(client)/chat/page.tsx` — render page_content header + announcement

---

## Task 1: DB Migration — Add 3 New Tables

**Files:**
- Modify: `scripts/migrate.ts`

- [ ] **Step 1: Add the new tables to MIGRATION_SQL**

In `scripts/migrate.ts`, append to the `MIGRATION_SQL` string (before the closing backtick):

```sql
  CREATE TABLE IF NOT EXISTS task_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS client_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id TEXT NOT NULL,
    template_id UUID REFERENCES task_templates(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'done')),
    due_date DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS page_content (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id TEXT NOT NULL,
    page TEXT NOT NULL,
    header TEXT,
    announcement TEXT,
    UNIQUE(client_id, page)
  );
```

- [ ] **Step 2: Run the migration**

```bash
cd C:/Users/regin/portal
npx tsx scripts/migrate.ts
```

Expected output: `Migration complete.`

- [ ] **Step 3: Commit**

```bash
git add scripts/migrate.ts
git commit -m "feat: add task_templates, client_tasks, page_content tables"
```

---

## Task 2: Update lib/airtable.ts — Add statusViewLink

**Files:**
- Modify: `lib/airtable.ts`

The Clients table in Airtable already has a "Status View Link" field (type: url) added via MCP. This task updates the TypeScript interface and mapping to include it.

- [ ] **Step 1: Add statusViewLink to AirtableClient interface**

In `lib/airtable.ts`, change the `AirtableClient` interface (lines 4–16) to:

```typescript
export interface AirtableClient {
  id: string
  clientId: string
  name: string
  email: string
  phone: string
  clientBaseId: string
  fileflowLink: string
  pleadingsViewLink: string
  discoveryViewLink: string
  calendarViewLink: string
  statusViewLink: string
  smsReminders: boolean
}
```

- [ ] **Step 2: Update getClientByEmail mapping**

In the `getClientByEmail` function return object (after `calendarViewLink`), add:

```typescript
    statusViewLink: r.fields["Status View Link"] ?? "",
```

- [ ] **Step 3: Update getAllClients mapping**

In the `getAllClients` function return object (after `calendarViewLink`), add:

```typescript
    statusViewLink: r.fields["Status View Link"] ?? "",
```

- [ ] **Step 4: Commit**

```bash
git add lib/airtable.ts
git commit -m "feat: add statusViewLink to AirtableClient"
```

---

## Task 3: Status Client Page

**Files:**
- Create: `app/(client)/status/page.tsx`
- Modify: `app/(client)/layout.tsx`

- [ ] **Step 1: Create the status page**

Create `app/(client)/status/page.tsx`:

```typescript
// app/(client)/status/page.tsx
import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { getClientByEmail } from "@/lib/airtable"
import AirtableEmbed from "@/components/ui/AirtableEmbed"

export default async function StatusPage() {
  const session = await auth()
  if (!session?.user?.email) redirect("/login")
  const client = await getClientByEmail(session.user.email)
  if (!client) redirect("/login")

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Case Status</h1>
      <AirtableEmbed url={client.statusViewLink} title="Case Status" />
    </div>
  )
}
```

- [ ] **Step 2: Add "status" to DEFAULT_PAGES in client layout**

In `app/(client)/layout.tsx`, update `DEFAULT_PAGES` (lines 8–17):

```typescript
const DEFAULT_PAGES = [
  "dashboard",
  "document-requests",
  "pleadings",
  "discovery",
  "status",
  "tasks",
  "calendar",
  "messages",
  "chat",
]
```

- [ ] **Step 3: Commit**

```bash
git add app/(client)/status/page.tsx app/(client)/layout.tsx
git commit -m "feat: add status page with Airtable embed"
```

---

## Task 4: Tasks Client Page + API Route

**Files:**
- Create: `app/(client)/tasks/page.tsx`
- Create: `app/api/tasks/route.ts`

- [ ] **Step 1: Create the tasks API route**

Create `app/api/tasks/route.ts`:

```typescript
// app/api/tasks/route.ts
import { auth } from "@/auth"
import { getClientByEmail } from "@/lib/airtable"
import { sql } from "@/lib/db"
import { NextResponse } from "next/server"

export async function GET() {
  const session = await auth()
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const client = await getClientByEmail(session.user.email)
  if (!client?.clientId) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  try {
    const result = await sql`
      SELECT id, title, description, status, due_date, created_at
      FROM client_tasks
      WHERE client_id = ${client.clientId}
      ORDER BY created_at ASC
    `
    return NextResponse.json({ tasks: result.rows })
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function PATCH(req: Request) {
  const session = await auth()
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const client = await getClientByEmail(session.user.email)
  if (!client?.clientId) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  let id: unknown, status: unknown
  try {
    const parsed = await req.json()
    id = parsed?.id
    status = parsed?.status
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  if (typeof id !== "string" || !id || !["pending", "done"].includes(status as string)) {
    return NextResponse.json({ error: "id and valid status required" }, { status: 400 })
  }

  try {
    const result = await sql`
      UPDATE client_tasks
      SET status = ${status as string}
      WHERE id = ${id} AND client_id = ${client.clientId}
      RETURNING id, status
    `
    if (result.rows.length === 0) return NextResponse.json({ error: "Not found" }, { status: 404 })
    return NextResponse.json({ task: result.rows[0] })
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
```

- [ ] **Step 2: Create the tasks client page**

Create `app/(client)/tasks/page.tsx`:

```typescript
// app/(client)/tasks/page.tsx
"use client"

import { useState, useEffect } from "react"

interface Task {
  id: string
  title: string
  description: string | null
  status: "pending" | "done"
  due_date: string | null
  created_at: string
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/tasks")
      .then((r) => r.json())
      .then((d) => { setTasks(d.tasks ?? []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  async function toggleStatus(task: Task) {
    const newStatus = task.status === "pending" ? "done" : "pending"
    const res = await fetch("/api/tasks", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: task.id, status: newStatus }),
    })
    if (res.ok) {
      setTasks((prev) => prev.map((t) => t.id === task.id ? { ...t, status: newStatus } : t))
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Tasks</h1>
      {loading ? (
        <p className="text-gray-400 text-sm">Loading...</p>
      ) : tasks.length === 0 ? (
        <div className="flex items-center justify-center h-48 bg-gray-50 rounded-lg border border-gray-200">
          <p className="text-sm text-gray-400">No tasks assigned yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {tasks.map((task) => (
            <div
              key={task.id}
              className={`flex items-start gap-4 p-4 rounded-lg border ${
                task.status === "done"
                  ? "bg-green-50 border-green-200"
                  : "bg-white border-gray-200"
              }`}
            >
              <button
                onClick={() => toggleStatus(task)}
                className={`mt-0.5 w-5 h-5 rounded border-2 flex-shrink-0 flex items-center justify-center transition-colors ${
                  task.status === "done"
                    ? "bg-green-600 border-green-600 text-white"
                    : "border-gray-300 hover:border-green-400"
                }`}
                aria-label={task.status === "done" ? "Mark pending" : "Mark done"}
              >
                {task.status === "done" && (
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium ${task.status === "done" ? "line-through text-gray-400" : "text-gray-900"}`}>
                  {task.title}
                </p>
                {task.description && (
                  <p className="mt-0.5 text-sm text-gray-500">{task.description}</p>
                )}
                {task.due_date && (
                  <p className="mt-1 text-xs text-gray-400">
                    Due: {new Date(task.due_date).toLocaleDateString()}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add app/(client)/tasks/page.tsx app/api/tasks/route.ts
git commit -m "feat: add client tasks page with toggle + API"
```

---

## Task 5: Admin Task Management Page + API

**Files:**
- Create: `app/(admin)/admin/tasks/page.tsx`
- Create: `app/api/admin/tasks/route.ts`

- [ ] **Step 1: Create the admin tasks API route**

Create `app/api/admin/tasks/route.ts`:

```typescript
// app/api/admin/tasks/route.ts
import { requireAdmin } from "@/lib/admin"
import { sql } from "@/lib/db"
import { NextResponse } from "next/server"

// GET: list all templates + all client tasks
export async function GET() {
  const check = await requireAdmin()
  if (check.status !== "ok") return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const [templates, tasks] = await Promise.all([
      sql`SELECT id, title, description, created_at FROM task_templates ORDER BY created_at ASC`,
      sql`SELECT id, client_id, title, description, status, due_date, created_at FROM client_tasks ORDER BY created_at DESC`,
    ])
    return NextResponse.json({ templates: templates.rows, tasks: tasks.rows })
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// POST: create template OR assign task to client
export async function POST(req: Request) {
  const check = await requireAdmin()
  if (check.status !== "ok") return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  let action: unknown, title: unknown, description: unknown, clientId: unknown, templateId: unknown, dueDate: unknown
  try {
    const parsed = await req.json()
    action = parsed?.action
    title = parsed?.title
    description = parsed?.description
    clientId = parsed?.clientId
    templateId = parsed?.templateId
    dueDate = parsed?.dueDate
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  if (action === "create_template") {
    if (typeof title !== "string" || !title.trim()) {
      return NextResponse.json({ error: "title required" }, { status: 400 })
    }
    try {
      const result = await sql`
        INSERT INTO task_templates (title, description)
        VALUES (${title.trim()}, ${typeof description === "string" ? description.trim() || null : null})
        RETURNING id, title, description, created_at
      `
      return NextResponse.json({ template: result.rows[0] }, { status: 201 })
    } catch {
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
  }

  if (action === "assign") {
    if (typeof clientId !== "string" || !clientId) {
      return NextResponse.json({ error: "clientId required" }, { status: 400 })
    }
    // Can assign from a template or with a custom title
    const taskTitle = typeof title === "string" && title.trim() ? title.trim() : null
    const taskDesc = typeof description === "string" && description.trim() ? description.trim() : null
    const taskTemplateId = typeof templateId === "string" && templateId ? templateId : null
    const taskDueDate = typeof dueDate === "string" && dueDate ? dueDate : null

    if (!taskTitle && !taskTemplateId) {
      return NextResponse.json({ error: "title or templateId required" }, { status: 400 })
    }

    try {
      // If assigning from template, fetch template title/desc
      let finalTitle = taskTitle
      let finalDesc = taskDesc
      if (taskTemplateId && !taskTitle) {
        const tmpl = await sql`SELECT title, description FROM task_templates WHERE id = ${taskTemplateId}`
        if (tmpl.rows.length === 0) return NextResponse.json({ error: "Template not found" }, { status: 404 })
        finalTitle = tmpl.rows[0].title
        finalDesc = tmpl.rows[0].description
      }

      const result = await sql`
        INSERT INTO client_tasks (client_id, template_id, title, description, due_date)
        VALUES (${clientId}, ${taskTemplateId}, ${finalTitle!}, ${finalDesc}, ${taskDueDate})
        RETURNING id, client_id, title, description, status, due_date, created_at
      `
      return NextResponse.json({ task: result.rows[0] }, { status: 201 })
    } catch {
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 })
}

// DELETE: delete template or client task
export async function DELETE(req: Request) {
  const check = await requireAdmin()
  if (check.status !== "ok") return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  let id: unknown, type: unknown
  try {
    const parsed = await req.json()
    id = parsed?.id
    type = parsed?.type
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  if (typeof id !== "string" || !id || !["template", "task"].includes(type as string)) {
    return NextResponse.json({ error: "id and type required" }, { status: 400 })
  }

  try {
    if (type === "template") {
      await sql`DELETE FROM task_templates WHERE id = ${id}`
    } else {
      await sql`DELETE FROM client_tasks WHERE id = ${id}`
    }
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
```

- [ ] **Step 2: Create admin tasks page**

Create `app/(admin)/admin/tasks/page.tsx`:

```typescript
// app/(admin)/admin/tasks/page.tsx
"use client"

import { useState, useEffect } from "react"

interface Template {
  id: string
  title: string
  description: string | null
  created_at: string
}

interface ClientTask {
  id: string
  client_id: string
  title: string
  description: string | null
  status: "pending" | "done"
  due_date: string | null
  created_at: string
}

export default function AdminTasksPage() {
  const [templates, setTemplates] = useState<Template[]>([])
  const [tasks, setTasks] = useState<ClientTask[]>([])
  const [loading, setLoading] = useState(true)

  // New template form
  const [newTitle, setNewTitle] = useState("")
  const [newDesc, setNewDesc] = useState("")

  // Assign form
  const [assignClientId, setAssignClientId] = useState("")
  const [assignTemplateId, setAssignTemplateId] = useState("")
  const [assignDueDate, setAssignDueDate] = useState("")

  async function load() {
    const res = await fetch("/api/admin/tasks")
    if (res.ok) {
      const d = await res.json()
      setTemplates(d.templates ?? [])
      setTasks(d.tasks ?? [])
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function createTemplate(e: React.FormEvent) {
    e.preventDefault()
    if (!newTitle.trim()) return
    const res = await fetch("/api/admin/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "create_template", title: newTitle, description: newDesc }),
    })
    if (res.ok) {
      setNewTitle("")
      setNewDesc("")
      load()
    }
  }

  async function assignTask(e: React.FormEvent) {
    e.preventDefault()
    if (!assignClientId.trim() || !assignTemplateId) return
    const res = await fetch("/api/admin/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "assign",
        clientId: assignClientId.trim(),
        templateId: assignTemplateId,
        dueDate: assignDueDate || undefined,
      }),
    })
    if (res.ok) {
      setAssignClientId("")
      setAssignTemplateId("")
      setAssignDueDate("")
      load()
    }
  }

  async function deleteTemplate(id: string) {
    await fetch("/api/admin/tasks", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, type: "template" }),
    })
    load()
  }

  async function deleteTask(id: string) {
    await fetch("/api/admin/tasks", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, type: "task" }),
    })
    load()
  }

  if (loading) return <p className="text-gray-400 text-sm">Loading...</p>

  return (
    <div className="space-y-10">
      <h1 className="text-2xl font-bold text-gray-900">Tasks</h1>

      {/* Templates */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-gray-800">Task Templates</h2>
        <form onSubmit={createTemplate} className="flex gap-3 flex-wrap">
          <input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Task title"
            className="flex-1 min-w-48 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
          <input
            value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)}
            placeholder="Description (optional)"
            className="flex-1 min-w-48 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="submit"
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
          >
            Add Template
          </button>
        </form>
        {templates.length === 0 ? (
          <p className="text-sm text-gray-400">No templates yet.</p>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
            {templates.map((t) => (
              <div key={t.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-gray-900">{t.title}</p>
                  {t.description && <p className="text-xs text-gray-500 mt-0.5">{t.description}</p>}
                </div>
                <button
                  onClick={() => deleteTemplate(t.id)}
                  className="text-xs text-red-500 hover:text-red-700 ml-4"
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Assign task */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-gray-800">Assign Task to Client</h2>
        <form onSubmit={assignTask} className="flex gap-3 flex-wrap items-end">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500">Client ID</label>
            <input
              value={assignClientId}
              onChange={(e) => setAssignClientId(e.target.value)}
              placeholder="e.g. smith-jane"
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500">Template</label>
            <select
              value={assignTemplateId}
              onChange={(e) => setAssignTemplateId(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            >
              <option value="">Select template</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>{t.title}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500">Due Date (optional)</label>
            <input
              type="date"
              value={assignDueDate}
              onChange={(e) => setAssignDueDate(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
          >
            Assign
          </button>
        </form>
      </section>

      {/* Assigned tasks */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-gray-800">Assigned Tasks</h2>
        {tasks.length === 0 ? (
          <p className="text-sm text-gray-400">No tasks assigned yet.</p>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
            {tasks.map((t) => (
              <div key={t.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-xs text-gray-400 mb-0.5">Client: {t.client_id}</p>
                  <p className="text-sm font-medium text-gray-900">{t.title}</p>
                  {t.description && <p className="text-xs text-gray-500 mt-0.5">{t.description}</p>}
                  {t.due_date && <p className="text-xs text-gray-400 mt-0.5">Due: {new Date(t.due_date).toLocaleDateString()}</p>}
                </div>
                <div className="flex items-center gap-3 ml-4">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    t.status === "done" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"
                  }`}>
                    {t.status}
                  </span>
                  <button
                    onClick={() => deleteTask(t.id)}
                    className="text-xs text-red-500 hover:text-red-700"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add app/(admin)/admin/tasks/page.tsx app/api/admin/tasks/route.ts
git commit -m "feat: admin task template management and client assignment"
```

---

## Task 6: Page Content API Route

**Files:**
- Create: `app/api/admin/page-content/route.ts`

- [ ] **Step 1: Create the page content API route**

Create `app/api/admin/page-content/route.ts`:

```typescript
// app/api/admin/page-content/route.ts
import { requireAdmin } from "@/lib/admin"
import { sql } from "@/lib/db"
import { NextResponse } from "next/server"

// GET: fetch page content for a client (all pages or one)
export async function GET(req: Request) {
  const check = await requireAdmin()
  if (check.status !== "ok") return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const clientId = searchParams.get("clientId")
  if (!clientId) return NextResponse.json({ error: "clientId required" }, { status: 400 })

  try {
    const result = await sql`
      SELECT page, header, announcement FROM page_content WHERE client_id = ${clientId}
    `
    // Return as map: { dashboard: { header, announcement }, ... }
    const content: Record<string, { header: string; announcement: string }> = {}
    for (const row of result.rows) {
      content[row.page] = { header: row.header ?? "", announcement: row.announcement ?? "" }
    }
    return NextResponse.json({ content })
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// PUT: upsert page content for a client+page
export async function PUT(req: Request) {
  const check = await requireAdmin()
  if (check.status !== "ok") return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  let clientId: unknown, page: unknown, header: unknown, announcement: unknown
  try {
    const parsed = await req.json()
    clientId = parsed?.clientId
    page = parsed?.page
    header = parsed?.header
    announcement = parsed?.announcement
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  if (typeof clientId !== "string" || !clientId || typeof page !== "string" || !page) {
    return NextResponse.json({ error: "clientId and page required" }, { status: 400 })
  }

  const headerVal = typeof header === "string" ? header.trim() || null : null
  const announcementVal = typeof announcement === "string" ? announcement.trim() || null : null

  try {
    await sql`
      INSERT INTO page_content (client_id, page, header, announcement)
      VALUES (${clientId}, ${page}, ${headerVal}, ${announcementVal})
      ON CONFLICT (client_id, page) DO UPDATE
        SET header = EXCLUDED.header,
            announcement = EXCLUDED.announcement
    `
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/admin/page-content/route.ts
git commit -m "feat: page content API with GET and upsert PUT"
```

---

## Task 7: Admin Page Content Editor UI

**Files:**
- Create: `app/(admin)/admin/clients/[clientId]/pages/page.tsx`

The pages list for a client: dashboard, document-requests, pleadings, discovery, status, tasks, calendar, messages, chat.

- [ ] **Step 1: Create the page content editor**

Create `app/(admin)/admin/clients/[clientId]/pages/page.tsx`:

```typescript
// app/(admin)/admin/clients/[clientId]/pages/page.tsx
"use client"

import { useState, useEffect, use } from "react"

const PAGES = [
  "dashboard",
  "document-requests",
  "pleadings",
  "discovery",
  "status",
  "tasks",
  "calendar",
  "messages",
  "chat",
]

interface PageContent {
  header: string
  announcement: string
}

type ContentMap = Record<string, PageContent>

export default function ClientPagesEditor({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = use(params)
  const [content, setContent] = useState<ContentMap>({})
  const [saving, setSaving] = useState<string | null>(null)
  const [saved, setSaved] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/admin/page-content?clientId=${encodeURIComponent(clientId)}`)
      .then((r) => r.json())
      .then((d) => {
        setContent(d.content ?? {})
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [clientId])

  function get(page: string): PageContent {
    return content[page] ?? { header: "", announcement: "" }
  }

  function update(page: string, field: "header" | "announcement", value: string) {
    setContent((prev) => ({
      ...prev,
      [page]: { ...get(page), [field]: value },
    }))
  }

  async function save(page: string) {
    setSaving(page)
    const { header, announcement } = get(page)
    const res = await fetch("/api/admin/page-content", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId, page, header, announcement }),
    })
    setSaving(null)
    if (res.ok) {
      setSaved(page)
      setTimeout(() => setSaved(null), 2000)
    }
  }

  if (loading) return <p className="text-gray-400 text-sm">Loading...</p>

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Page Editor</h1>
        <p className="text-sm text-gray-500 mt-1">Client: <span className="font-medium">{clientId}</span></p>
      </div>
      {PAGES.map((page) => {
        const c = get(page)
        return (
          <div key={page} className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
            <h2 className="text-sm font-semibold text-gray-700 capitalize">{page.replace(/-/g, " ")}</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Header</label>
                <input
                  value={c.header}
                  onChange={(e) => update(page, "header", e.target.value)}
                  placeholder={`Custom header for ${page} (leave blank for default)`}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Announcement</label>
                <textarea
                  value={c.announcement}
                  onChange={(e) => update(page, "announcement", e.target.value)}
                  placeholder="Optional message shown at the top of this page for this client"
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => save(page)}
                  disabled={saving === page}
                  className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving === page ? "Saving..." : "Save"}
                </button>
                {saved === page && (
                  <span className="text-xs text-green-600 font-medium">Saved</span>
                )}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add "app/(admin)/admin/clients/[clientId]/pages/page.tsx"
git commit -m "feat: per-client page content editor in admin"
```

---

## Task 8: Create a lib/page-content.ts Helper + Update Client Pages

**Files:**
- Create: `lib/page-content.ts`
- Modify: `app/(client)/dashboard/page.tsx`
- Modify: `app/(client)/pleadings/page.tsx`
- Modify: `app/(client)/discovery/page.tsx`
- Modify: `app/(client)/calendar/page.tsx`
- Modify: `app/(client)/document-requests/page.tsx`
- Modify: `app/(client)/messages/page.tsx`
- Modify: `app/(client)/chat/page.tsx`
- Modify: `app/(client)/status/page.tsx`
- Modify: `app/(client)/tasks/page.tsx` (needs to become a server wrapper + client component)

- [ ] **Step 1: Create the page-content helper**

Create `lib/page-content.ts`:

```typescript
// lib/page-content.ts
import { sql } from "@/lib/db"

export interface PageContent {
  header: string | null
  announcement: string | null
}

export async function getPageContent(clientId: string, page: string): Promise<PageContent> {
  try {
    const result = await sql`
      SELECT header, announcement FROM page_content
      WHERE client_id = ${clientId} AND page = ${page}
    `
    if (result.rows.length === 0) return { header: null, announcement: null }
    return { header: result.rows[0].header, announcement: result.rows[0].announcement }
  } catch {
    return { header: null, announcement: null }
  }
}
```

- [ ] **Step 2: Create PageHeader component**

Create `components/ui/PageHeader.tsx`:

```typescript
// components/ui/PageHeader.tsx
interface PageHeaderProps {
  defaultTitle: string
  header: string | null
  announcement: string | null
}

export default function PageHeader({ defaultTitle, header, announcement }: PageHeaderProps) {
  return (
    <div className="space-y-3">
      <h1 className="text-2xl font-bold text-gray-900">{header || defaultTitle}</h1>
      {announcement && (
        <div className="px-4 py-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
          {announcement}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Update dashboard/page.tsx**

Replace the `<h1>` and paragraph at lines 39–50 in `app/(client)/dashboard/page.tsx` with PageHeader. Add the import and getPageContent call. Full updated file:

```typescript
// app/(client)/dashboard/page.tsx
import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { getClientByEmail, getClientTasks } from "@/lib/airtable"
import { processTasks, DashboardData } from "@/lib/claude"
import StatusLane from "@/components/dashboard/StatusLane"
import PageHeader from "@/components/ui/PageHeader"
import { getPageContent } from "@/lib/page-content"

const LANE_COLORS: ("red" | "yellow" | "green")[] = ["red", "yellow", "green"]
const DEFAULT_LANE_COLOR = "red" as const

export default async function DashboardPage() {
  const session = await auth()
  if (!session?.user?.email) redirect("/login")

  const client = await getClientByEmail(session.user.email)
  if (!client) redirect("/login")

  const [pageContent, tasksResult] = await Promise.all([
    getPageContent(client.clientId, "dashboard"),
    (async () => {
      try {
        const tasks = await getClientTasks(client.clientBaseId)
        const today = new Date().toISOString().split("T")[0]
        return await processTasks(tasks, today)
      } catch (err) {
        console.error("[DashboardPage] Failed to load tasks:", err)
        return {
          sections: [
            { title: "Outstanding Documents", items: [] },
            { title: "In Progress", items: [] },
            { title: "Completed", items: [] },
          ],
        } as DashboardData
      }
    })(),
  ])

  const dashboard = tasksResult

  const overdueCount = dashboard.sections
    .flatMap((s) => s.items)
    .filter((i) => i.overdue).length

  const announcement = pageContent.announcement || (overdueCount > 0
    ? `${overdueCount} overdue item${overdueCount !== 1 ? "s" : ""} — please respond promptly`
    : null)

  return (
    <div className="space-y-6">
      <PageHeader
        defaultTitle="Dashboard"
        header={pageContent.header}
        announcement={announcement}
      />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {dashboard.sections.map((section, i) => (
          <StatusLane key={section.title} section={section} color={LANE_COLORS[i] ?? DEFAULT_LANE_COLOR} />
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Update pleadings/page.tsx**

Full updated `app/(client)/pleadings/page.tsx`:

```typescript
// app/(client)/pleadings/page.tsx
import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { getClientByEmail } from "@/lib/airtable"
import AirtableEmbed from "@/components/ui/AirtableEmbed"
import PageHeader from "@/components/ui/PageHeader"
import { getPageContent } from "@/lib/page-content"

export default async function PleadingsPage() {
  const session = await auth()
  if (!session?.user?.email) redirect("/login")
  const client = await getClientByEmail(session.user.email)
  if (!client) redirect("/login")

  const pageContent = await getPageContent(client.clientId, "pleadings")

  return (
    <div className="space-y-6">
      <PageHeader defaultTitle="Pleadings" header={pageContent.header} announcement={pageContent.announcement} />
      <AirtableEmbed url={client.pleadingsViewLink} title="Pleadings" />
    </div>
  )
}
```

- [ ] **Step 5: Update discovery/page.tsx**

Read `app/(client)/discovery/page.tsx` first, then apply same pattern:
- Import `PageHeader` and `getPageContent`
- Fetch `getPageContent(client.clientId, "discovery")`
- Replace `<h1>Discovery</h1>` with `<PageHeader defaultTitle="Discovery" header={pageContent.header} announcement={pageContent.announcement} />`

- [ ] **Step 6: Update calendar/page.tsx**

Same pattern as discovery, page name = `"calendar"`, default title = `"Calendar"`.

- [ ] **Step 7: Update document-requests/page.tsx**

Same pattern, page name = `"document-requests"`, default title = `"Document Requests"`. Note: this page has two return paths (url empty + url present) — add `getPageContent` call before the conditional and pass to both PageHeader usages. For the empty-url case, show just the header/announcement above the "not configured" message.

Full updated `app/(client)/document-requests/page.tsx`:

```typescript
// app/(client)/document-requests/page.tsx
import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { getClientByEmail } from "@/lib/airtable"
import PageHeader from "@/components/ui/PageHeader"
import { getPageContent } from "@/lib/page-content"

export default async function DocumentRequestsPage() {
  const session = await auth()
  if (!session?.user?.email) redirect("/login")
  const client = await getClientByEmail(session.user.email)
  if (!client) redirect("/login")

  const [url, pageContent] = [client.fileflowLink, await getPageContent(client.clientId, "document-requests")]

  if (!url) {
    return (
      <div className="space-y-6">
        <PageHeader defaultTitle="Document Requests" header={pageContent.header} announcement={pageContent.announcement} />
        <div className="flex items-center justify-center h-64 bg-gray-50 rounded-lg border border-gray-200">
          <p className="text-sm text-gray-500">Document portal not configured. Please contact your attorney.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader defaultTitle="Document Requests" header={pageContent.header} announcement={pageContent.announcement} />
      <div className="flex flex-col items-center justify-center gap-4 py-16 bg-gray-50 rounded-lg border border-gray-200">
        <p className="text-gray-600 text-center max-w-sm">
          Your document portal opens in a new tab where you can upload and manage requested documents.
        </p>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
        >
          Open Document Portal ↗
        </a>
      </div>
    </div>
  )
}
```

- [ ] **Step 8: Update messages/page.tsx**

Read `app/(client)/messages/page.tsx`, add same PageHeader + getPageContent pattern, page = `"messages"`.

- [ ] **Step 9: Update chat/page.tsx**

`app/(client)/chat/page.tsx` is currently a client component. Convert to a server wrapper that fetches page content and passes it as props to a client child.

Create `components/chat/ChatPageClient.tsx` (move the current chat/page.tsx content into it, accept `header` and `announcement` props).

Full updated `app/(client)/chat/page.tsx`:

```typescript
// app/(client)/chat/page.tsx
import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { getClientByEmail } from "@/lib/airtable"
import { getPageContent } from "@/lib/page-content"
import Script from "next/script"
import PageHeader from "@/components/ui/PageHeader"

export default async function ChatPage() {
  const session = await auth()
  if (!session?.user?.email) redirect("/login")
  const client = await getClientByEmail(session.user.email)
  if (!client) redirect("/login")

  const pageContent = await getPageContent(client.clientId, "chat")

  return (
    <div className="space-y-6">
      <PageHeader defaultTitle="Chat" header={pageContent.header} announcement={pageContent.announcement} />
      <div className="flex items-center justify-center h-64 bg-gray-50 rounded-lg border border-gray-200">
        <p className="text-sm text-gray-500">
          Click the chat bubble in the bottom corner to start a conversation.
        </p>
      </div>
      <Script
        src="https://chat-assets.frontapp.com/v1/chat.bundle.js"
        strategy="afterInteractive"
        onLoad={() => {
          // @ts-ignore
          window.FrontChat("init", {
            chatId: "4ba9a1366a0c3ac55355eceb11901b9e",
            useDefaultLauncher: true,
          })
        }}
      />
    </div>
  )
}
```

- [ ] **Step 10: Update status/page.tsx**

Add `getPageContent` + `PageHeader` to `app/(client)/status/page.tsx`:

```typescript
// app/(client)/status/page.tsx
import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { getClientByEmail } from "@/lib/airtable"
import AirtableEmbed from "@/components/ui/AirtableEmbed"
import PageHeader from "@/components/ui/PageHeader"
import { getPageContent } from "@/lib/page-content"

export default async function StatusPage() {
  const session = await auth()
  if (!session?.user?.email) redirect("/login")
  const client = await getClientByEmail(session.user.email)
  if (!client) redirect("/login")

  const pageContent = await getPageContent(client.clientId, "status")

  return (
    <div className="space-y-6">
      <PageHeader defaultTitle="Case Status" header={pageContent.header} announcement={pageContent.announcement} />
      <AirtableEmbed url={client.statusViewLink} title="Case Status" />
    </div>
  )
}
```

- [ ] **Step 11: Update tasks/page.tsx**

`tasks/page.tsx` is a client component. Convert to a server wrapper that passes pageContent props. Replace the entire file:

```typescript
// app/(client)/tasks/page.tsx
import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { getClientByEmail } from "@/lib/airtable"
import { getPageContent } from "@/lib/page-content"
import TasksClient from "@/components/tasks/TasksClient"
import PageHeader from "@/components/ui/PageHeader"

export default async function TasksPage() {
  const session = await auth()
  if (!session?.user?.email) redirect("/login")
  const client = await getClientByEmail(session.user.email)
  if (!client) redirect("/login")

  const pageContent = await getPageContent(client.clientId, "tasks")

  return (
    <div className="space-y-6">
      <PageHeader defaultTitle="Tasks" header={pageContent.header} announcement={pageContent.announcement} />
      <TasksClient />
    </div>
  )
}
```

Create `components/tasks/TasksClient.tsx` with the client-side task list logic (move the interactive parts from the original tasks/page.tsx into this component, removing the `<h1>` since it's now in the server wrapper):

```typescript
// components/tasks/TasksClient.tsx
"use client"

import { useState, useEffect } from "react"

interface Task {
  id: string
  title: string
  description: string | null
  status: "pending" | "done"
  due_date: string | null
  created_at: string
}

export default function TasksClient() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/tasks")
      .then((r) => r.json())
      .then((d) => { setTasks(d.tasks ?? []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  async function toggleStatus(task: Task) {
    const newStatus = task.status === "pending" ? "done" : "pending"
    const res = await fetch("/api/tasks", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: task.id, status: newStatus }),
    })
    if (res.ok) {
      setTasks((prev) => prev.map((t) => t.id === task.id ? { ...t, status: newStatus } : t))
    }
  }

  if (loading) return <p className="text-gray-400 text-sm">Loading...</p>

  if (tasks.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 bg-gray-50 rounded-lg border border-gray-200">
        <p className="text-sm text-gray-400">No tasks assigned yet.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {tasks.map((task) => (
        <div
          key={task.id}
          className={`flex items-start gap-4 p-4 rounded-lg border ${
            task.status === "done"
              ? "bg-green-50 border-green-200"
              : "bg-white border-gray-200"
          }`}
        >
          <button
            onClick={() => toggleStatus(task)}
            className={`mt-0.5 w-5 h-5 rounded border-2 flex-shrink-0 flex items-center justify-center transition-colors ${
              task.status === "done"
                ? "bg-green-600 border-green-600 text-white"
                : "border-gray-300 hover:border-green-400"
            }`}
            aria-label={task.status === "done" ? "Mark pending" : "Mark done"}
          >
            {task.status === "done" && (
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            )}
          </button>
          <div className="flex-1 min-w-0">
            <p className={`text-sm font-medium ${task.status === "done" ? "line-through text-gray-400" : "text-gray-900"}`}>
              {task.title}
            </p>
            {task.description && (
              <p className="mt-0.5 text-sm text-gray-500">{task.description}</p>
            )}
            {task.due_date && (
              <p className="mt-1 text-xs text-gray-400">
                Due: {new Date(task.due_date).toLocaleDateString()}
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 12: Commit all page updates**

```bash
git add lib/page-content.ts components/ui/PageHeader.tsx \
  "app/(client)/dashboard/page.tsx" \
  "app/(client)/pleadings/page.tsx" \
  "app/(client)/discovery/page.tsx" \
  "app/(client)/calendar/page.tsx" \
  "app/(client)/document-requests/page.tsx" \
  "app/(client)/messages/page.tsx" \
  "app/(client)/chat/page.tsx" \
  "app/(client)/status/page.tsx" \
  "app/(client)/tasks/page.tsx" \
  components/tasks/TasksClient.tsx
git commit -m "feat: add page_content header/announcement to all client pages"
```

---

## Task 9: Update Admin Client List + Nav

**Files:**
- Modify: `app/(admin)/admin/page.tsx`
- Modify: `app/(admin)/layout.tsx`

- [ ] **Step 1: Update admin page to pull clients from Airtable and add Pages/Tasks links**

Full updated `app/(admin)/admin/page.tsx`:

```typescript
// app/(admin)/admin/page.tsx
import { sql } from "@/lib/db"
import { getAllClients } from "@/lib/airtable"
import Link from "next/link"

export default async function AdminPage() {
  const [clients, activityResult] = await Promise.all([
    getAllClients(),
    sql`
      SELECT
        client_id,
        COUNT(*) FILTER (WHERE sender = 'client' AND read = false) AS unread_chat,
        0 AS unread_messages
      FROM chat_messages
      GROUP BY client_id
      UNION ALL
      SELECT
        client_id,
        0 AS unread_chat,
        COUNT(*) FILTER (WHERE read = false) AS unread_messages
      FROM messages
      GROUP BY client_id
    `.catch(() => ({ rows: [] })),
  ])

  const activityMap = new Map<string, { unread_chat: number; unread_messages: number }>()
  for (const row of activityResult.rows) {
    const existing = activityMap.get(row.client_id) ?? { unread_chat: 0, unread_messages: 0 }
    activityMap.set(row.client_id, {
      unread_chat: existing.unread_chat + parseInt(row.unread_chat ?? "0"),
      unread_messages: existing.unread_messages + parseInt(row.unread_messages ?? "0"),
    })
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Clients</h1>
      {clients.length === 0 ? (
        <p className="text-gray-500">No clients found in Airtable.</p>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
          {clients.map((c) => {
            const activity = activityMap.get(c.clientId) ?? { unread_chat: 0, unread_messages: 0 }
            return (
              <div key={c.clientId} className="flex items-center justify-between px-6 py-4 flex-wrap gap-3">
                <div>
                  <p className="text-sm font-medium text-gray-900">{c.name || c.clientId}</p>
                  <p className="text-xs text-gray-400">{c.email} · ID: {c.clientId}</p>
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                  {activity.unread_chat > 0 && (
                    <span className="text-xs bg-blue-100 text-blue-700 px-2.5 py-1 rounded-full font-medium">
                      {activity.unread_chat} unread chat
                    </span>
                  )}
                  <Link href={`/admin/chat/${c.clientId}`} className="text-sm text-blue-600 hover:underline">Chat</Link>
                  <Link href={`/admin/messages/${c.clientId}`} className="text-sm text-blue-600 hover:underline">Message</Link>
                  <Link href={`/admin/clients/${c.clientId}/pages`} className="text-sm text-blue-600 hover:underline">Pages</Link>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Add Tasks link to admin sidebar nav**

Full updated `app/(admin)/layout.tsx`:

```typescript
// app/(admin)/layout.tsx
import { redirect } from "next/navigation"
import { requireAdmin } from "@/lib/admin"
import Link from "next/link"

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const check = await requireAdmin()
  if (check.status !== "ok") redirect("/login")

  return (
    <div className="flex min-h-screen bg-gray-50">
      <aside className="w-56 min-h-screen bg-white border-r border-gray-200">
        <div className="p-5 border-b border-gray-100">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Admin</p>
          <p className="text-sm text-gray-600 mt-0.5 truncate">{check.email}</p>
        </div>
        <nav className="p-3 space-y-1">
          <Link href="/admin" className="block px-3 py-2 rounded-lg text-sm text-gray-700 hover:bg-gray-100">
            Clients
          </Link>
          <Link href="/admin/tasks" className="block px-3 py-2 rounded-lg text-sm text-gray-700 hover:bg-gray-100">
            Tasks
          </Link>
          <Link href="/admin/settings" className="block px-3 py-2 rounded-lg text-sm text-gray-700 hover:bg-gray-100">
            Settings
          </Link>
        </nav>
      </aside>
      <main className="flex-1 p-8">{children}</main>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add "app/(admin)/admin/page.tsx" "app/(admin)/layout.tsx"
git commit -m "feat: update admin client list with Airtable data and Pages/Tasks links"
```

---

## Task 10: Add Status View Link to Airtable + Final Deploy

**Files:**
- No code changes — Airtable field already added via MCP before this plan was written
- Final build verification + deploy

- [ ] **Step 1: Verify build passes**

```bash
cd C:/Users/regin/portal
npm run build
```

Expected: no TypeScript errors, all 24 routes listed.

- [ ] **Step 2: Deploy to production**

```bash
npx vercel --prod --scope=edwardslaw
```

Expected: `Deployment ... ready.` and `Aliased: https://edwards-law-portal.vercel.app`

- [ ] **Step 3: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: build issues from portal expansion"
```
