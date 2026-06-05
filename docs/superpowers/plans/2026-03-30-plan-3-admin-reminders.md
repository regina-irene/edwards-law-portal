# Client Portal — Plan 3: Admin Interface + Smart Reminders

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the firm-facing admin interface (client list, chat replies, message composer, nav reordering) and a Vercel Cron job that sends email and SMS reminders for overdue and upcoming tasks.

**Architecture:** Admin pages live under `/admin` and are protected by a check against the `admin_users` table in Vercel Postgres. The reminder cron job runs daily via Vercel Cron, fetches all clients from Airtable, checks their tasks for upcoming/overdue items, and sends email via Resend and SMS via Twilio. The cron endpoint is protected by a `CRON_SECRET` header.

**Tech Stack:** Next.js 15 App Router, Auth.js v5, `@vercel/postgres`, Resend SDK, Twilio SDK, Airtable REST API, `@dnd-kit/core` + `@dnd-kit/sortable` (nav reordering), Tailwind CSS, TypeScript

**Prerequisite:** Plans 1 and 2 must be complete.

---

## File Structure

```
portal/
├── app/
│   ├── (admin)/
│   │   ├── layout.tsx                             # Admin-only layout with role check
│   │   └── admin/
│   │       ├── page.tsx                           # Client list with unread counts
│   │       ├── chat/
│   │       │   └── [clientId]/page.tsx            # Admin: read + reply to client chat
│   │       ├── messages/
│   │       │   └── [clientId]/page.tsx            # Admin: compose + send announcement
│   │       └── settings/
│   │           └── page.tsx                       # Nav order drag-to-reorder
│   └── api/
│       ├── admin/
│       │   ├── chat/route.ts                      # GET all clients + unread, POST firm reply
│       │   └── messages/route.ts                  # POST new announcement to a client
│       └── cron/
│           └── reminders/route.ts                 # Daily cron handler
├── lib/
│   ├── resend.ts                                  # Send email via Resend SDK
│   └── twilio.ts                                  # Send SMS via Twilio SDK
└── __tests__/
    ├── api/
    │   ├── admin-chat.test.ts
    │   ├── admin-messages.test.ts
    │   └── cron-reminders.test.ts
    └── lib/
        ├── resend.test.ts
        └── twilio.test.ts
```

---

### Task 1: Email sender (Resend)

**Files:**
- Create: `lib/resend.ts`
- Create: `__tests__/lib/resend.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// __tests__/lib/resend.test.ts
import { sendReminderEmail } from "@/lib/resend"

jest.mock("resend", () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: {
      send: jest.fn().mockResolvedValue({ data: { id: "email-id-123" }, error: null }),
    },
  })),
}))

describe("sendReminderEmail", () => {
  beforeEach(() => {
    process.env.RESEND_API_KEY = "test-key"
    process.env.EMAIL_FROM = "portal@edwardslaw.com"
  })

  it("sends email with correct fields", async () => {
    const { Resend } = require("resend")
    const mockSend = Resend.mock.results[0]?.value.emails.send ?? jest.fn()

    await sendReminderEmail({
      to: "client@test.com",
      clientName: "Jane Smith",
      taskName: "Bank Statement",
      dueDate: "2026-04-10",
      overdue: false,
    })

    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "client@test.com",
        from: "portal@edwardslaw.com",
        subject: expect.stringContaining("Bank Statement"),
      })
    )
  })

  it("sends overdue email with urgent subject", async () => {
    const { Resend } = require("resend")
    const instance = new Resend()

    await sendReminderEmail({
      to: "client@test.com",
      clientName: "Jane Smith",
      taskName: "Bank Statement",
      dueDate: "2026-03-28",
      overdue: true,
    })

    expect(instance.emails.send).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: expect.stringMatching(/overdue|urgent/i),
      })
    )
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- --testPathPattern="resend"
```

Expected: FAIL — `Cannot find module '@/lib/resend'`

- [ ] **Step 3: Create lib/resend.ts**

```typescript
// lib/resend.ts
import { Resend } from "resend"

const resend = new Resend(process.env.RESEND_API_KEY!)
const FROM = process.env.EMAIL_FROM ?? "portal@edwardslaw.com"
const PORTAL_URL = process.env.AUTH_URL ?? "https://portal.edwardslaw.com"

interface ReminderEmailOptions {
  to: string
  clientName: string
  taskName: string
  dueDate: string
  overdue: boolean
}

export async function sendReminderEmail(opts: ReminderEmailOptions): Promise<void> {
  const { to, clientName, taskName, dueDate, overdue } = opts

  const subject = overdue
    ? `OVERDUE — Action Required: ${taskName}`
    : `Reminder: ${taskName} is due soon`

  const formattedDate = new Date(dueDate + "T00:00:00").toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  })

  const body = overdue
    ? `Dear ${clientName},\n\nThis is an urgent reminder that the following item is overdue:\n\n"${taskName}" — was due ${formattedDate}\n\nPlease log in to your portal as soon as possible:\n${PORTAL_URL}\n\nIf you have any questions, please contact your attorney.\n\nEdwards Family Law`
    : `Dear ${clientName},\n\nThis is a reminder that the following item is due soon:\n\n"${taskName}" — due ${formattedDate}\n\nPlease log in to your portal to submit the requested item:\n${PORTAL_URL}\n\nThank you,\nEdwards Family Law`

  await resend.emails.send({
    from: FROM,
    to,
    subject,
    text: body,
  })
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- --testPathPattern="resend"
```

Expected: `Tests: 2 passed, 2 total`

- [ ] **Step 5: Commit**

```bash
git add lib/resend.ts __tests__/lib/resend.test.ts
git commit -m "feat: add Resend email sender with tests"
```

---

### Task 2: SMS sender (Twilio)

**Files:**
- Create: `lib/twilio.ts`
- Create: `__tests__/lib/twilio.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// __tests__/lib/twilio.test.ts
import { sendReminderSMS } from "@/lib/twilio"

jest.mock("twilio", () => {
  const mockCreate = jest.fn().mockResolvedValue({ sid: "SM123" })
  return jest.fn().mockImplementation(() => ({
    messages: { create: mockCreate },
  }))
})

describe("sendReminderSMS", () => {
  beforeEach(() => {
    process.env.TWILIO_ACCOUNT_SID = "ACtest"
    process.env.TWILIO_AUTH_TOKEN = "test-token"
    process.env.TWILIO_FROM_NUMBER = "+15550001234"
    process.env.AUTH_URL = "https://portal.edwardslaw.com"
  })

  it("sends SMS with task name and portal link", async () => {
    const twilio = require("twilio")
    const instance = twilio()

    await sendReminderSMS({
      to: "+15559876543",
      clientName: "Jane Smith",
      taskName: "Bank Statement",
      overdue: false,
    })

    expect(instance.messages.create).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "+15559876543",
        from: "+15550001234",
        body: expect.stringContaining("Bank Statement"),
      })
    )
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- --testPathPattern="twilio"
```

Expected: FAIL — `Cannot find module '@/lib/twilio'`

- [ ] **Step 3: Create lib/twilio.ts**

```typescript
// lib/twilio.ts
import twilio from "twilio"

const PORTAL_URL = process.env.AUTH_URL ?? "https://portal.edwardslaw.com"

interface ReminderSMSOptions {
  to: string
  clientName: string
  taskName: string
  overdue: boolean
}

export async function sendReminderSMS(opts: ReminderSMSOptions): Promise<void> {
  const { to, clientName, taskName, overdue } = opts

  const client = twilio(
    process.env.TWILIO_ACCOUNT_SID!,
    process.env.TWILIO_AUTH_TOKEN!
  )

  const body = overdue
    ? `Edwards Family Law: OVERDUE — "${taskName}" requires your immediate attention. Log in: ${PORTAL_URL}`
    : `Edwards Family Law: Reminder — "${taskName}" is due soon. Log in: ${PORTAL_URL}`

  await client.messages.create({
    body,
    from: process.env.TWILIO_FROM_NUMBER!,
    to,
  })
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- --testPathPattern="twilio"
```

Expected: `Tests: 1 passed, 1 total`

- [ ] **Step 5: Commit**

```bash
git add lib/twilio.ts __tests__/lib/twilio.test.ts
git commit -m "feat: add Twilio SMS sender with tests"
```

---

### Task 3: Cron reminder handler

**Files:**
- Create: `app/api/cron/reminders/route.ts`
- Create: `vercel.json`
- Create: `__tests__/api/cron-reminders.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `__tests__/api/cron-reminders.test.ts`:
```typescript
import { GET } from "@/app/api/cron/reminders/route"

jest.mock("@/lib/airtable", () => ({
  getAllClients: jest.fn(),
  getClientTasks: jest.fn(),
}))
jest.mock("@/lib/resend", () => ({ sendReminderEmail: jest.fn() }))
jest.mock("@/lib/twilio", () => ({ sendReminderSMS: jest.fn() }))

import { getAllClients, getClientTasks } from "@/lib/airtable"
import { sendReminderEmail } from "@/lib/resend"
import { sendReminderSMS } from "@/lib/twilio"

const mockGetAllClients = getAllClients as jest.Mock
const mockGetClientTasks = getClientTasks as jest.Mock
const mockSendEmail = sendReminderEmail as jest.Mock
const mockSendSMS = sendReminderSMS as jest.Mock

beforeEach(() => {
  jest.clearAllMocks()
  process.env.CRON_SECRET = "test-secret"
})

describe("GET /api/cron/reminders", () => {
  it("returns 401 without correct CRON_SECRET header", async () => {
    const req = new Request("http://localhost/api/cron/reminders", {
      headers: { authorization: "Bearer wrong-secret" },
    })
    const res = await GET(req)
    expect(res.status).toBe(401)
  })

  it("sends email for task due in 3 days", async () => {
    const today = new Date()
    const in3Days = new Date(today)
    in3Days.setDate(today.getDate() + 3)
    const dueDateStr = in3Days.toISOString().split("T")[0]

    mockGetAllClients.mockResolvedValueOnce([
      {
        clientId: "C001",
        name: "Jane Smith",
        email: "jane@test.com",
        phone: "+15551234567",
        clientBaseId: "appCLIENT",
        smsReminders: false,
      },
    ])
    mockGetClientTasks.mockResolvedValueOnce([
      { id: "recT1", name: "Bank Statement", status: "Outstanding", dueDate: dueDateStr, type: "Financials", matter: "Divorce" },
    ])

    const req = new Request("http://localhost/api/cron/reminders", {
      headers: { authorization: "Bearer test-secret" },
    })
    const res = await GET(req)
    expect(res.status).toBe(200)
    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "jane@test.com",
        taskName: "Bank Statement",
        overdue: false,
      })
    )
    expect(mockSendSMS).not.toHaveBeenCalled() // smsReminders: false
  })

  it("sends SMS when smsReminders is true", async () => {
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const dueDateStr = yesterday.toISOString().split("T")[0]

    mockGetAllClients.mockResolvedValueOnce([
      {
        clientId: "C001",
        name: "Jane Smith",
        email: "jane@test.com",
        phone: "+15551234567",
        clientBaseId: "appCLIENT",
        smsReminders: true,
      },
    ])
    mockGetClientTasks.mockResolvedValueOnce([
      { id: "recT1", name: "Tax Return", status: "Outstanding", dueDate: dueDateStr, type: "Financials", matter: "Divorce" },
    ])

    const req = new Request("http://localhost/api/cron/reminders", {
      headers: { authorization: "Bearer test-secret" },
    })
    await GET(req)
    expect(mockSendSMS).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "+15551234567",
        taskName: "Tax Return",
        overdue: true,
      })
    )
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- --testPathPattern="cron-reminders"
```

Expected: FAIL — `Cannot find module '@/app/api/cron/reminders/route'`

- [ ] **Step 3: Create the cron handler**

```bash
mkdir -p app/api/cron/reminders
```

```typescript
// app/api/cron/reminders/route.ts
import { NextResponse } from "next/server"
import { getAllClients, getClientTasks } from "@/lib/airtable"
import { sendReminderEmail } from "@/lib/resend"
import { sendReminderSMS } from "@/lib/twilio"

// Returns true if dueDate is 0, 1, or 3 days from today
function shouldRemind(dueDate: string, today: Date): { remind: boolean; overdue: boolean } {
  const due = new Date(dueDate + "T00:00:00")
  const todayMidnight = new Date(today)
  todayMidnight.setHours(0, 0, 0, 0)

  const diffMs = due.getTime() - todayMidnight.getTime()
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays < 0) return { remind: true, overdue: true }   // past due
  if (diffDays === 0) return { remind: true, overdue: false } // due today
  if (diffDays === 3) return { remind: true, overdue: false } // 3 days out
  return { remind: false, overdue: false }
}

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization")
  const expected = `Bearer ${process.env.CRON_SECRET}`
  if (authHeader !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const today = new Date()
  const clients = await getAllClients()
  const results: { clientId: string; sent: number; errors: number }[] = []

  for (const client of clients) {
    let sent = 0
    let errors = 0

    try {
      const tasks = await getClientTasks(client.clientBaseId)
      const completedStatuses = ["complete", "completed", "done"]

      for (const task of tasks) {
        if (!task.dueDate) continue
        if (completedStatuses.includes(task.status.toLowerCase())) continue

        const { remind, overdue } = shouldRemind(task.dueDate, today)
        if (!remind) continue

        try {
          await sendReminderEmail({
            to: client.email,
            clientName: client.name,
            taskName: task.name,
            dueDate: task.dueDate,
            overdue,
          })
          sent++
        } catch {
          errors++
        }

        if (client.smsReminders && client.phone) {
          try {
            await sendReminderSMS({
              to: client.phone,
              clientName: client.name,
              taskName: task.name,
              overdue,
            })
            sent++
          } catch {
            errors++
          }
        }
      }
    } catch {
      errors++
    }

    results.push({ clientId: client.clientId, sent, errors })
  }

  return NextResponse.json({ ok: true, results })
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- --testPathPattern="cron-reminders"
```

Expected: `Tests: 3 passed, 3 total`

- [ ] **Step 5: Create vercel.json with cron schedule**

```json
{
  "crons": [
    {
      "path": "/api/cron/reminders",
      "schedule": "0 9 * * *"
    }
  ]
}
```

This runs the reminder job every day at 9:00 AM UTC.

> **Important:** Add `CRON_SECRET` to Vercel environment variables. Vercel automatically sends this as `Authorization: Bearer <CRON_SECRET>` header when invoking the cron route.

- [ ] **Step 6: Commit**

```bash
git add app/api/cron/reminders/route.ts vercel.json __tests__/api/cron-reminders.test.ts
git commit -m "feat: add daily reminder cron job with email and SMS"
```

---

### Task 4: Admin API routes

**Files:**
- Create: `app/api/admin/chat/route.ts`
- Create: `app/api/admin/messages/route.ts`
- Create: `__tests__/api/admin-chat.test.ts`
- Create: `__tests__/api/admin-messages.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `__tests__/api/admin-chat.test.ts`:
```typescript
import { GET, POST } from "@/app/api/admin/chat/route"

jest.mock("@/auth", () => ({ auth: jest.fn() }))
jest.mock("@/lib/db", () => ({ sql: jest.fn() }))

import { auth } from "@/auth"
import { sql } from "@/lib/db"

const mockAuth = auth as jest.Mock
const mockSql = sql as unknown as jest.Mock

beforeEach(() => {
  jest.clearAllMocks()
})

describe("GET /api/admin/chat", () => {
  it("returns 401 for non-admin", async () => {
    mockAuth.mockResolvedValueOnce({ user: { email: "client@test.com" } })
    mockSql.mockResolvedValueOnce({ rows: [] }) // not in admin_users
    const req = new Request("http://localhost/api/admin/chat?clientId=C001")
    const res = await GET(req)
    expect(res.status).toBe(403)
  })

  it("returns chat messages for admin", async () => {
    mockAuth.mockResolvedValueOnce({ user: { email: "admin@edwardslaw.com" } })
    mockSql.mockResolvedValueOnce({ rows: [{ email: "admin@edwardslaw.com" }] }) // is admin
    mockSql.mockResolvedValueOnce({
      rows: [{ id: "uuid-1", sender: "client", body: "Hello", created_at: "2026-03-01T10:00:00Z" }],
    })
    const req = new Request("http://localhost/api/admin/chat?clientId=C001")
    const res = await GET(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.messages).toHaveLength(1)
  })
})

describe("POST /api/admin/chat", () => {
  it("posts a firm reply", async () => {
    mockAuth.mockResolvedValueOnce({ user: { email: "admin@edwardslaw.com" } })
    mockSql.mockResolvedValueOnce({ rows: [{ email: "admin@edwardslaw.com" }] }) // is admin
    mockSql.mockResolvedValueOnce({
      rows: [{ id: "new-uuid", sender: "firm", body: "Got it.", created_at: new Date().toISOString() }],
    })
    const req = new Request("http://localhost/api/admin/chat", {
      method: "POST",
      body: JSON.stringify({ clientId: "C001", body: "Got it." }),
    })
    const res = await POST(req)
    expect(res.status).toBe(201)
  })
})
```

Create `__tests__/api/admin-messages.test.ts`:
```typescript
import { POST } from "@/app/api/admin/messages/route"

jest.mock("@/auth", () => ({ auth: jest.fn() }))
jest.mock("@/lib/db", () => ({ sql: jest.fn() }))

import { auth } from "@/auth"
import { sql } from "@/lib/db"

const mockAuth = auth as jest.Mock
const mockSql = sql as unknown as jest.Mock

beforeEach(() => {
  jest.clearAllMocks()
})

describe("POST /api/admin/messages", () => {
  it("returns 403 for non-admin", async () => {
    mockAuth.mockResolvedValueOnce({ user: { email: "client@test.com" } })
    mockSql.mockResolvedValueOnce({ rows: [] }) // not in admin_users
    const req = new Request("http://localhost/api/admin/messages", {
      method: "POST",
      body: JSON.stringify({ clientId: "C001", body: "Please submit your documents." }),
    })
    const res = await POST(req)
    expect(res.status).toBe(403)
  })

  it("posts an announcement as admin", async () => {
    mockAuth.mockResolvedValueOnce({ user: { email: "admin@edwardslaw.com" } })
    mockSql.mockResolvedValueOnce({ rows: [{ email: "admin@edwardslaw.com" }] }) // is admin
    mockSql.mockResolvedValueOnce({
      rows: [{ id: "uuid-1", body: "Please submit your documents.", created_at: new Date().toISOString() }],
    })
    const req = new Request("http://localhost/api/admin/messages", {
      method: "POST",
      body: JSON.stringify({ clientId: "C001", body: "Please submit your documents." }),
    })
    const res = await POST(req)
    expect(res.status).toBe(201)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- --testPathPattern="admin-chat|admin-messages"
```

Expected: FAIL — module not found errors.

- [ ] **Step 3: Create a shared admin auth helper**

```bash
mkdir -p app/api/admin
```

Create `lib/admin.ts`:
```typescript
// lib/admin.ts — checks if the current session user is an admin
import { auth } from "@/auth"
import { sql } from "@/lib/db"

export async function requireAdmin(): Promise<{ email: string } | null> {
  const session = await auth()
  if (!session?.user?.email) return null

  const result = await sql`
    SELECT email FROM admin_users WHERE email = ${session.user.email} LIMIT 1
  `
  if (result.rows.length === 0) return null

  return { email: session.user.email }
}
```

- [ ] **Step 4: Create admin chat API route**

```bash
mkdir -p app/api/admin/chat
```

```typescript
// app/api/admin/chat/route.ts
import { requireAdmin } from "@/lib/admin"
import { sql } from "@/lib/db"
import { NextResponse } from "next/server"

export async function GET(req: Request) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const clientId = searchParams.get("clientId")
  if (!clientId) return NextResponse.json({ error: "clientId required" }, { status: 400 })

  const result = await sql`
    SELECT id, sender, body, created_at, read
    FROM chat_messages
    WHERE client_id = ${clientId}
    ORDER BY created_at ASC
    LIMIT 100
  `

  return NextResponse.json({ messages: result.rows })
}

export async function POST(req: Request) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { clientId, body } = await req.json()
  if (!clientId || !body?.trim()) {
    return NextResponse.json({ error: "clientId and body required" }, { status: 400 })
  }

  const result = await sql`
    INSERT INTO chat_messages (client_id, sender, body)
    VALUES (${clientId}, 'firm', ${body.trim()})
    RETURNING id, sender, body, created_at
  `

  return NextResponse.json({ message: result.rows[0] }, { status: 201 })
}
```

- [ ] **Step 5: Create admin messages API route**

```bash
mkdir -p app/api/admin/messages
```

```typescript
// app/api/admin/messages/route.ts
import { requireAdmin } from "@/lib/admin"
import { sql } from "@/lib/db"
import { NextResponse } from "next/server"

export async function POST(req: Request) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { clientId, body } = await req.json()
  if (!clientId || !body?.trim()) {
    return NextResponse.json({ error: "clientId and body required" }, { status: 400 })
  }

  const result = await sql`
    INSERT INTO messages (client_id, body)
    VALUES (${clientId}, ${body.trim()})
    RETURNING id, body, created_at
  `

  return NextResponse.json({ message: result.rows[0] }, { status: 201 })
}
```

- [ ] **Step 6: Run tests to verify they pass**

```bash
npm test -- --testPathPattern="admin-chat|admin-messages"
```

Expected: `Tests: 5 passed, 5 total`

- [ ] **Step 7: Commit**

```bash
git add lib/admin.ts app/api/admin/chat/route.ts app/api/admin/messages/route.ts __tests__/api/admin-chat.test.ts __tests__/api/admin-messages.test.ts
git commit -m "feat: add admin chat and messages API routes with role check"
```

---

### Task 5: Admin layout + client list page

**Files:**
- Create: `app/(admin)/layout.tsx`
- Create: `app/(admin)/admin/page.tsx`

- [ ] **Step 1: Create the admin layout**

```bash
mkdir -p "app/(admin)/admin"
```

```tsx
// app/(admin)/layout.tsx
import { redirect } from "next/navigation"
import { requireAdmin } from "@/lib/admin"
import Link from "next/link"

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin()
  if (!admin) redirect("/login")

  return (
    <div className="flex min-h-screen bg-gray-50">
      <aside className="w-56 min-h-screen bg-white border-r border-gray-200">
        <div className="p-5 border-b border-gray-100">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Admin</p>
          <p className="text-sm text-gray-600 mt-0.5 truncate">{admin.email}</p>
        </div>
        <nav className="p-3 space-y-1">
          <Link href="/admin" className="block px-3 py-2 rounded-lg text-sm text-gray-700 hover:bg-gray-100">
            Clients
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

- [ ] **Step 2: Create admin home page (client list with unread counts)**

```tsx
// app/(admin)/admin/page.tsx
import { sql } from "@/lib/db"
import Link from "next/link"

interface ClientSummary {
  client_id: string
  unread_chat: number
  unread_messages: number
}

export default async function AdminPage() {
  // Get all distinct client IDs with their unread counts
  const result = await sql`
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
  `

  // Aggregate by client_id
  const clientMap = new Map<string, { unread_chat: number; unread_messages: number }>()
  for (const row of result.rows) {
    const existing = clientMap.get(row.client_id) ?? { unread_chat: 0, unread_messages: 0 }
    clientMap.set(row.client_id, {
      unread_chat: existing.unread_chat + parseInt(row.unread_chat ?? "0"),
      unread_messages: existing.unread_messages + parseInt(row.unread_messages ?? "0"),
    })
  }

  const clients: ClientSummary[] = Array.from(clientMap.entries()).map(([client_id, counts]) => ({
    client_id,
    ...counts,
  }))

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Clients</h1>
      {clients.length === 0 ? (
        <p className="text-gray-500">No client activity yet.</p>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
          {clients.map((c) => (
            <div key={c.client_id} className="flex items-center justify-between px-6 py-4">
              <span className="text-sm font-medium text-gray-900">{c.client_id}</span>
              <div className="flex items-center gap-4">
                {c.unread_chat > 0 && (
                  <Link
                    href={`/admin/chat/${c.client_id}`}
                    className="text-xs bg-blue-100 text-blue-700 px-2.5 py-1 rounded-full font-medium hover:bg-blue-200"
                  >
                    {c.unread_chat} unread chat
                  </Link>
                )}
                <Link
                  href={`/admin/chat/${c.client_id}`}
                  className="text-sm text-blue-600 hover:underline"
                >
                  Chat →
                </Link>
                <Link
                  href={`/admin/messages/${c.client_id}`}
                  className="text-sm text-blue-600 hover:underline"
                >
                  Message →
                </Link>
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
git add "app/(admin)/layout.tsx" "app/(admin)/admin/page.tsx"
git commit -m "feat: add admin layout and client list page"
```

---

### Task 6: Admin chat and messages pages

**Files:**
- Create: `app/(admin)/admin/chat/[clientId]/page.tsx`
- Create: `app/(admin)/admin/messages/[clientId]/page.tsx`

- [ ] **Step 1: Create admin chat page**

```bash
mkdir -p "app/(admin)/admin/chat/[clientId]"
```

```tsx
// app/(admin)/admin/chat/[clientId]/page.tsx
"use client"

import { useState, useEffect, useCallback } from "react"
import ChatThread from "@/components/chat/ChatThread"
import ChatInput from "@/components/chat/ChatInput"

interface ChatMessage {
  id: string
  sender: "client" | "firm"
  body: string
  created_at: string
}

export default function AdminChatPage({ params }: { params: { clientId: string } }) {
  const [messages, setMessages] = useState<ChatMessage[]>([])

  const fetchMessages = useCallback(async () => {
    const res = await fetch(`/api/admin/chat?clientId=${params.clientId}`)
    if (res.ok) {
      const data = await res.json()
      setMessages(data.messages)
    }
  }, [params.clientId])

  useEffect(() => {
    fetchMessages()
    const interval = setInterval(fetchMessages, 30_000)
    return () => clearInterval(interval)
  }, [fetchMessages])

  async function handleSend(body: string) {
    const res = await fetch("/api/admin/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId: params.clientId, body }),
    })
    if (res.ok) {
      const data = await res.json()
      setMessages((prev) => [...prev, data.message])
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-4">
        Chat — <span className="text-gray-500 font-normal">{params.clientId}</span>
      </h1>
      <div className="flex-1 overflow-y-auto bg-gray-50 rounded-xl border border-gray-200 px-4">
        <ChatThread messages={messages} />
      </div>
      <div className="mt-4">
        <ChatInput onSend={handleSend} />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create admin messages composer page**

```bash
mkdir -p "app/(admin)/admin/messages/[clientId]"
```

```tsx
// app/(admin)/admin/messages/[clientId]/page.tsx
"use client"

import { useState } from "react"

export default function AdminMessagesPage({ params }: { params: { clientId: string } }) {
  const [body, setBody] = useState("")
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle")

  async function handleSend() {
    if (!body.trim()) return
    setStatus("sending")
    const res = await fetch("/api/admin/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId: params.clientId, body }),
    })
    if (res.ok) {
      setBody("")
      setStatus("sent")
      setTimeout(() => setStatus("idle"), 3000)
    } else {
      setStatus("error")
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">
        Send Message — <span className="text-gray-500 font-normal">{params.clientId}</span>
      </h1>
      <p className="text-sm text-gray-500">
        This message will appear in the client's Messages inbox in the portal.
      </p>

      <div className="space-y-4">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Write your message to the client..."
          rows={6}
          className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
        />
        <div className="flex items-center gap-4">
          <button
            onClick={handleSend}
            disabled={!body.trim() || status === "sending"}
            className="px-6 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {status === "sending" ? "Sending..." : "Send Message"}
          </button>
          {status === "sent" && (
            <span className="text-sm text-green-600 font-medium">Message sent.</span>
          )}
          {status === "error" && (
            <span className="text-sm text-red-600">Failed to send. Try again.</span>
          )}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add "app/(admin)/admin/chat/[clientId]/page.tsx" "app/(admin)/admin/messages/[clientId]/page.tsx"
git commit -m "feat: add admin chat and message composer pages"
```

---

### Task 7: Admin settings — nav order drag-to-reorder

**Files:**
- Create: `app/(admin)/admin/settings/page.tsx`

- [ ] **Step 1: Create the settings page**

```bash
mkdir -p "app/(admin)/admin/settings"
```

```tsx
// app/(admin)/admin/settings/page.tsx
"use client"

import { useState, useEffect } from "react"
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core"
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"

const PAGE_LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  "document-requests": "Document Requests",
  pleadings: "Pleadings",
  discovery: "Discovery",
  calendar: "Calendar",
  messages: "Messages",
  chat: "Chat",
}

function SortableItem({ id }: { id: string }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex items-center gap-3 px-4 py-3 bg-white rounded-lg border ${
        isDragging ? "border-blue-400 shadow-lg opacity-80" : "border-gray-200"
      } cursor-grab active:cursor-grabbing`}
      {...attributes}
      {...listeners}
    >
      <svg className="w-4 h-4 text-gray-400 shrink-0" fill="currentColor" viewBox="0 0 20 20">
        <path d="M7 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm6 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM7 8a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm6 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm-6 6a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm6 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4z"/>
      </svg>
      <span className="text-sm font-medium text-gray-800">{PAGE_LABELS[id] ?? id}</span>
    </div>
  )
}

export default function AdminSettingsPage() {
  const [pages, setPages] = useState<string[]>([])
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle")

  const sensors = useSensors(useSensor(PointerSensor))

  useEffect(() => {
    fetch("/api/nav").then((r) => r.json()).then((data) => setPages(data.pages))
  }, [])

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (over && active.id !== over.id) {
      setPages((items) => {
        const oldIndex = items.indexOf(String(active.id))
        const newIndex = items.indexOf(String(over.id))
        return arrayMove(items, oldIndex, newIndex)
      })
    }
  }

  async function handleSave() {
    setSaveStatus("saving")
    await fetch("/api/nav", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pages }),
    })
    setSaveStatus("saved")
    setTimeout(() => setSaveStatus("idle"), 2000)
  }

  return (
    <div className="max-w-sm space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="mt-1 text-sm text-gray-500">Drag to reorder the client portal navigation.</p>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={pages} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {pages.map((page) => (
              <SortableItem key={page} id={page} />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <button
        onClick={handleSave}
        disabled={saveStatus === "saving"}
        className="px-6 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
      >
        {saveStatus === "saving" ? "Saving..." : saveStatus === "saved" ? "Saved!" : "Save Order"}
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add "app/(admin)/admin/settings/page.tsx"
git commit -m "feat: add admin settings page with drag-to-reorder nav"
```

---

### Task 8: Seed first admin user + final build verification

> **Before running:** Add your email to the `admin_users` table so you can log in as admin.

- [ ] **Step 1: Add admin user to database**

Replace `your@email.com` with your actual email:

```bash
PGPASSWORD=your_password psql $POSTGRES_URL -c "INSERT INTO admin_users (email, name) VALUES ('your@email.com', 'Regina Edwards') ON CONFLICT (email) DO NOTHING;"
```

Or via Vercel dashboard: Storage → your database → Data → admin_users → Insert row.

- [ ] **Step 2: Add CRON_SECRET to Vercel environment variables**

In Vercel dashboard: Settings → Environment Variables → Add:
- `CRON_SECRET` = a random string (e.g., output of `openssl rand -base64 32`)

- [ ] **Step 3: Run full test suite**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 4: Run production build**

```bash
npm run build
```

Expected: build completes with no errors.

- [ ] **Step 5: Final commit for Plan 3**

```bash
git add .
git commit -m "feat: Plan 3 complete — admin interface and smart reminders"
```

---

## Plan 3 Complete

All three plans are done. The portal is ready to deploy.

**Deployment checklist:**

- [ ] Push to GitHub repository
- [ ] Connect repo to Vercel project
- [ ] Set all environment variables in Vercel dashboard (see `.env.local.example`)
- [ ] Set custom domain `portal.edwardslaw.com` in Vercel → Settings → Domains
- [ ] Add `https://portal.edwardslaw.com/api/auth/callback/google` to Google OAuth authorized redirect URIs
- [ ] Run `npm run migrate` once against production Vercel Postgres (or via Vercel CLI: `vercel env pull && npm run migrate`)
- [ ] Add yourself to `admin_users` table in production database
- [ ] Verify Vercel Cron is listed under Settings → Cron Jobs in Vercel dashboard
- [ ] Send a test magic link to confirm Resend is working
- [ ] Test a client login with a real Airtable client record
