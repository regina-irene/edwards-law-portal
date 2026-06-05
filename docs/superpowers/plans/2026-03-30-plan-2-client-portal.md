# Client Portal — Plan 2: Client Portal Pages

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build all client-facing portal pages: the configurable sidebar nav, dashboard (three-lane, Claude-powered), FileFlow document requests, embedded Airtable views (pleadings, discovery, calendar), messages inbox, and two-way chat.

**Architecture:** All pages are Next.js App Router server components (except chat/messages which need client-side polling). The client layout server component fetches the session and resolves the client's Airtable record once per page load. Each page gets that client record as a prop. Airtable embeds use a shared `AirtableEmbed` component that renders an iframe on desktop and a fallback link on mobile.

**Tech Stack:** Next.js 15 App Router, Auth.js v5, `@vercel/postgres`, Airtable REST API, Anthropic SDK, `@dnd-kit/core`, `@dnd-kit/sortable`, Tailwind CSS, TypeScript

**Prerequisite:** Plan 1 must be complete. All `lib/` helpers and database tables must exist.

---

## File Structure

```
portal/
├── app/
│   ├── (client)/
│   │   ├── layout.tsx                       # Fetches session + client record, renders sidebar
│   │   ├── dashboard/page.tsx               # Three-lane status dashboard
│   │   ├── document-requests/page.tsx       # FileFlow iframe + mobile fallback
│   │   ├── pleadings/page.tsx               # Airtable embed
│   │   ├── discovery/page.tsx               # Airtable embed
│   │   ├── calendar/page.tsx                # Airtable embed
│   │   ├── messages/page.tsx                # Client messages inbox
│   │   └── chat/page.tsx                    # Two-way chat (client component)
│   └── api/
│       ├── airtable/
│       │   └── tasks/route.ts               # GET tasks for current client
│       ├── claude/
│       │   └── route.ts                     # POST tasks → structured dashboard JSON
│       ├── messages/
│       │   └── route.ts                     # GET messages for current client
│       ├── chat/
│       │   └── route.ts                     # GET/POST chat messages
│       └── nav/
│           └── route.ts                     # GET/PUT nav page order
├── components/
│   ├── nav/
│   │   ├── Sidebar.tsx                      # Sidebar with ordered nav links + unread badges
│   │   └── NavItem.tsx                      # Single nav link
│   ├── dashboard/
│   │   ├── StatusLane.tsx                   # One column (Outstanding / In Progress / Completed)
│   │   └── TaskCard.tsx                     # Single task card with status badge + due date
│   ├── chat/
│   │   ├── ChatThread.tsx                   # Scrollable message list
│   │   └── ChatInput.tsx                    # Textarea + send button
│   └── ui/
│       └── AirtableEmbed.tsx                # iframe on desktop, link on mobile
└── __tests__/
    ├── components/
    │   ├── dashboard/
    │   │   ├── StatusLane.test.tsx
    │   │   └── TaskCard.test.tsx
    │   └── ui/
    │       └── AirtableEmbed.test.tsx
    └── api/
        ├── messages.test.ts
        └── chat.test.ts
```

---

### Task 1: Nav order API route

**Files:**
- Create: `app/api/nav/route.ts`
- Create: `__tests__/api/nav.test.ts`

- [ ] **Step 1: Write the failing tests**

```bash
mkdir -p __tests__/api
```

Create `__tests__/api/nav.test.ts`:
```typescript
// __tests__/api/nav.test.ts
import { GET, PUT } from "@/app/api/nav/route"
import { sql } from "@vercel/postgres"

jest.mock("@vercel/postgres", () => ({
  sql: jest.fn(),
}))

jest.mock("@/auth", () => ({
  auth: jest.fn(),
}))

import { auth } from "@/auth"

const mockSql = sql as unknown as jest.Mock
const mockAuth = auth as jest.Mock

const DEFAULT_PAGES = ["dashboard", "document-requests", "pleadings", "discovery", "calendar", "messages", "chat"]

beforeEach(() => {
  jest.clearAllMocks()
  mockAuth.mockResolvedValue({ user: { email: "test@test.com" } })
})

describe("GET /api/nav", () => {
  it("returns default order when no row exists", async () => {
    mockSql.mockResolvedValueOnce({ rows: [] })
    const req = new Request("http://localhost/api/nav")
    const res = await GET(req)
    const body = await res.json()
    expect(body.pages).toEqual(DEFAULT_PAGES)
  })

  it("returns stored order when row exists", async () => {
    const custom = ["chat", "dashboard", "messages"]
    mockSql.mockResolvedValueOnce({ rows: [{ pages: custom }] })
    const req = new Request("http://localhost/api/nav")
    const res = await GET(req)
    const body = await res.json()
    expect(body.pages).toEqual(custom)
  })
})

describe("PUT /api/nav", () => {
  it("saves new page order", async () => {
    const newOrder = ["messages", "dashboard", "chat"]
    mockSql.mockResolvedValueOnce({ rows: [] }) // check existing
    mockSql.mockResolvedValueOnce({ rows: [] }) // upsert
    const req = new Request("http://localhost/api/nav", {
      method: "PUT",
      body: JSON.stringify({ pages: newOrder }),
    })
    const res = await PUT(req)
    expect(res.status).toBe(200)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- --testPathPattern="nav"
```

Expected: FAIL — `Cannot find module '@/app/api/nav/route'`

- [ ] **Step 3: Create app/api/nav/route.ts**

```bash
mkdir -p app/api/nav
```

```typescript
// app/api/nav/route.ts
import { auth } from "@/auth"
import { sql } from "@/lib/db"
import { NextResponse } from "next/server"

const DEFAULT_PAGES = [
  "dashboard",
  "document-requests",
  "pleadings",
  "discovery",
  "calendar",
  "messages",
  "chat",
]

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const result = await sql`SELECT pages FROM nav_order LIMIT 1`
  const pages = result.rows[0]?.pages ?? DEFAULT_PAGES
  return NextResponse.json({ pages })
}

export async function PUT(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { pages } = await req.json()
  if (!Array.isArray(pages)) {
    return NextResponse.json({ error: "pages must be an array" }, { status: 400 })
  }

  const existing = await sql`SELECT id FROM nav_order LIMIT 1`
  if (existing.rows.length > 0) {
    await sql`UPDATE nav_order SET pages = ${JSON.stringify(pages)}::jsonb WHERE id = ${existing.rows[0].id}`
  } else {
    await sql`INSERT INTO nav_order (pages) VALUES (${JSON.stringify(pages)}::jsonb)`
  }

  return NextResponse.json({ pages })
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- --testPathPattern="nav"
```

Expected: `Tests: 3 passed, 3 total`

- [ ] **Step 5: Commit**

```bash
git add app/api/nav/route.ts __tests__/api/nav.test.ts
git commit -m "feat: add nav order API route"
```

---

### Task 2: Sidebar and NavItem components

**Files:**
- Create: `components/nav/NavItem.tsx`
- Create: `components/nav/Sidebar.tsx`

- [ ] **Step 1: Create NavItem component**

```bash
mkdir -p components/nav
```

```tsx
// components/nav/NavItem.tsx
"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

const PAGE_LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  "document-requests": "Document Requests",
  pleadings: "Pleadings",
  discovery: "Discovery",
  calendar: "Calendar",
  messages: "Messages",
  chat: "Chat",
}

interface NavItemProps {
  page: string
  unreadCount?: number
}

export default function NavItem({ page, unreadCount = 0 }: NavItemProps) {
  const pathname = usePathname()
  const href = `/${page}`
  const isActive = pathname === href || pathname.startsWith(href + "/")
  const label = PAGE_LABELS[page] ?? page

  return (
    <Link
      href={href}
      className={`flex items-center justify-between px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
        isActive
          ? "bg-blue-600 text-white"
          : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
      }`}
    >
      <span>{label}</span>
      {unreadCount > 0 && (
        <span className="ml-2 inline-flex items-center justify-center w-5 h-5 text-xs font-bold rounded-full bg-red-500 text-white">
          {unreadCount > 9 ? "9+" : unreadCount}
        </span>
      )}
    </Link>
  )
}
```

- [ ] **Step 2: Create Sidebar component**

```tsx
// components/nav/Sidebar.tsx
import NavItem from "./NavItem"

interface SidebarProps {
  pages: string[]
  clientName: string
  unreadMessages: number
  unreadChat: number
}

export default function Sidebar({ pages, clientName, unreadMessages, unreadChat }: SidebarProps) {
  const getUnread = (page: string) => {
    if (page === "messages") return unreadMessages
    if (page === "chat") return unreadChat
    return 0
  }

  return (
    <aside className="w-64 min-h-screen bg-white border-r border-gray-200 flex flex-col">
      <div className="p-6 border-b border-gray-100">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Edwards Family Law</p>
        <p className="mt-1 text-sm font-medium text-gray-900 truncate">{clientName}</p>
      </div>
      <nav className="flex-1 p-3 space-y-1">
        {pages.map((page) => (
          <NavItem key={page} page={page} unreadCount={getUnread(page)} />
        ))}
      </nav>
      <div className="p-4 border-t border-gray-100">
        <a
          href="/api/auth/signout"
          className="text-xs text-gray-400 hover:text-gray-600"
        >
          Sign out
        </a>
      </div>
    </aside>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add components/nav/NavItem.tsx components/nav/Sidebar.tsx
git commit -m "feat: add Sidebar and NavItem navigation components"
```

---

### Task 3: Client portal layout

**Files:**
- Create: `app/(client)/layout.tsx`

- [ ] **Step 1: Create the directory structure**

```bash
mkdir -p "app/(client)"
```

- [ ] **Step 2: Create the client layout**

This is a server component that fetches the session and client record, then renders the sidebar.

```tsx
// app/(client)/layout.tsx
import { redirect } from "next/navigation"
import { auth } from "@/auth"
import { getClientByEmail } from "@/lib/airtable"
import { sql } from "@/lib/db"
import Sidebar from "@/components/nav/Sidebar"

const DEFAULT_PAGES = [
  "dashboard",
  "document-requests",
  "pleadings",
  "discovery",
  "calendar",
  "messages",
  "chat",
]

async function getNavPages(): Promise<string[]> {
  const result = await sql`SELECT pages FROM nav_order LIMIT 1`
  return result.rows[0]?.pages ?? DEFAULT_PAGES
}

async function getUnreadCounts(clientId: string) {
  const [msgResult, chatResult] = await Promise.all([
    sql`SELECT COUNT(*) as count FROM messages WHERE client_id = ${clientId} AND read = false`,
    sql`SELECT COUNT(*) as count FROM chat_messages WHERE client_id = ${clientId} AND sender = 'firm' AND read = false`,
  ])
  return {
    messages: parseInt(msgResult.rows[0]?.count ?? "0"),
    chat: parseInt(chatResult.rows[0]?.count ?? "0"),
  }
}

export default async function ClientLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session?.user?.email) redirect("/login")

  const client = await getClientByEmail(session.user.email)
  if (!client) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-xl font-semibold text-gray-900">Access Not Found</h1>
          <p className="mt-2 text-gray-600">
            Your email is not linked to a client account. Please contact your attorney.
          </p>
        </div>
      </div>
    )
  }

  const [pages, unread] = await Promise.all([
    getNavPages(),
    getUnreadCounts(client.clientId),
  ])

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar
        pages={pages}
        clientName={client.name}
        unreadMessages={unread.messages}
        unreadChat={unread.chat}
      />
      <main className="flex-1 p-8 overflow-auto">{children}</main>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add "app/(client)/layout.tsx"
git commit -m "feat: add client portal layout with sidebar and unread counts"
```

---

### Task 4: Airtable tasks API route + Claude API route

**Files:**
- Create: `app/api/airtable/tasks/route.ts`
- Create: `app/api/claude/route.ts`

- [ ] **Step 1: Create airtable tasks route**

```bash
mkdir -p app/api/airtable/tasks
```

```typescript
// app/api/airtable/tasks/route.ts
import { auth } from "@/auth"
import { getClientByEmail, getClientTasks } from "@/lib/airtable"
import { NextResponse } from "next/server"

export async function GET() {
  const session = await auth()
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const client = await getClientByEmail(session.user.email)
  if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 })

  const tasks = await getClientTasks(client.clientBaseId)
  return NextResponse.json({ tasks })
}
```

- [ ] **Step 2: Create Claude processing route**

```bash
mkdir -p app/api/claude
```

```typescript
// app/api/claude/route.ts
import { auth } from "@/auth"
import { processTasks } from "@/lib/claude"
import { AirtableTask } from "@/lib/airtable"
import { NextResponse } from "next/server"

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { tasks } = await req.json() as { tasks: AirtableTask[] }
  if (!Array.isArray(tasks)) {
    return NextResponse.json({ error: "tasks must be an array" }, { status: 400 })
  }

  const today = new Date().toISOString().split("T")[0]
  const dashboard = await processTasks(tasks, today)
  return NextResponse.json(dashboard)
}
```

- [ ] **Step 3: Commit**

```bash
git add app/api/airtable/tasks/route.ts app/api/claude/route.ts
git commit -m "feat: add Airtable tasks and Claude processing API routes"
```

---

### Task 5: TaskCard and StatusLane components

**Files:**
- Create: `components/dashboard/TaskCard.tsx`
- Create: `components/dashboard/StatusLane.tsx`
- Create: `__tests__/components/dashboard/TaskCard.test.tsx`
- Create: `__tests__/components/dashboard/StatusLane.test.tsx`

- [ ] **Step 1: Write the failing component tests**

```bash
mkdir -p __tests__/components/dashboard
```

Create `__tests__/components/dashboard/TaskCard.test.tsx`:
```tsx
import { render, screen } from "@testing-library/react"
import TaskCard from "@/components/dashboard/TaskCard"
import { DashboardItem } from "@/lib/claude"

const baseItem: DashboardItem = {
  id: "rec1",
  name: "Bank Statement",
  dueDate: "2026-04-10",
  status: "outstanding",
  overdue: false,
  type: "Financials",
}

describe("TaskCard", () => {
  it("renders task name", () => {
    render(<TaskCard item={baseItem} />)
    expect(screen.getByText("Bank Statement")).toBeInTheDocument()
  })

  it("renders due date", () => {
    render(<TaskCard item={baseItem} />)
    expect(screen.getByText(/Apr 10, 2026/i)).toBeInTheDocument()
  })

  it("shows OVERDUE badge when item is overdue", () => {
    const overdueItem = { ...baseItem, overdue: true }
    render(<TaskCard item={overdueItem} />)
    expect(screen.getByText("OVERDUE")).toBeInTheDocument()
  })

  it("does not show OVERDUE badge when not overdue", () => {
    render(<TaskCard item={baseItem} />)
    expect(screen.queryByText("OVERDUE")).not.toBeInTheDocument()
  })
})
```

Create `__tests__/components/dashboard/StatusLane.test.tsx`:
```tsx
import { render, screen } from "@testing-library/react"
import StatusLane from "@/components/dashboard/StatusLane"
import { DashboardSection } from "@/lib/claude"

const section: DashboardSection = {
  title: "Outstanding Documents",
  items: [
    { id: "r1", name: "Bank Statement", dueDate: "2026-04-10", status: "outstanding", overdue: false, type: "Financials" },
    { id: "r2", name: "Tax Return", dueDate: "2026-04-15", status: "outstanding", overdue: false, type: "Financials" },
  ],
}

describe("StatusLane", () => {
  it("renders section title", () => {
    render(<StatusLane section={section} color="red" />)
    expect(screen.getByText("Outstanding Documents")).toBeInTheDocument()
  })

  it("renders all items", () => {
    render(<StatusLane section={section} color="red" />)
    expect(screen.getByText("Bank Statement")).toBeInTheDocument()
    expect(screen.getByText("Tax Return")).toBeInTheDocument()
  })

  it("shows empty state when no items", () => {
    render(<StatusLane section={{ ...section, items: [] }} color="red" />)
    expect(screen.getByText(/nothing here/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- --testPathPattern="TaskCard|StatusLane"
```

Expected: FAIL — `Cannot find module '@/components/dashboard/TaskCard'`

- [ ] **Step 3: Create TaskCard component**

```bash
mkdir -p components/dashboard
```

```tsx
// components/dashboard/TaskCard.tsx
import { DashboardItem } from "@/lib/claude"

interface TaskCardProps {
  item: DashboardItem
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "No due date"
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

export default function TaskCard({ item }: TaskCardProps) {
  return (
    <div className={`bg-white rounded-lg border p-4 space-y-2 ${item.overdue ? "border-red-300 bg-red-50" : "border-gray-200"}`}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-gray-900 leading-snug">{item.name}</p>
        {item.overdue && (
          <span className="shrink-0 text-xs font-bold text-red-600 bg-red-100 px-2 py-0.5 rounded">
            OVERDUE
          </span>
        )}
      </div>
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>{item.type}</span>
        <span>{formatDate(item.dueDate)}</span>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Create StatusLane component**

```tsx
// components/dashboard/StatusLane.tsx
import { DashboardSection } from "@/lib/claude"
import TaskCard from "./TaskCard"

interface StatusLaneProps {
  section: DashboardSection
  color: "red" | "yellow" | "green"
}

const colorMap = {
  red: { dot: "bg-red-500", title: "text-red-700", header: "border-red-200 bg-red-50" },
  yellow: { dot: "bg-yellow-400", title: "text-yellow-700", header: "border-yellow-200 bg-yellow-50" },
  green: { dot: "bg-green-500", title: "text-green-700", header: "border-green-200 bg-green-50" },
}

export default function StatusLane({ section, color }: StatusLaneProps) {
  const c = colorMap[color]

  return (
    <div className="flex flex-col min-w-0">
      <div className={`flex items-center gap-2 px-4 py-3 rounded-t-lg border-b ${c.header}`}>
        <span className={`w-2.5 h-2.5 rounded-full ${c.dot}`} />
        <h3 className={`text-sm font-semibold ${c.title}`}>
          {section.title}
          <span className="ml-2 text-xs font-normal opacity-70">({section.items.length})</span>
        </h3>
      </div>
      <div className="flex-1 space-y-3 p-4 bg-gray-50 rounded-b-lg min-h-32">
        {section.items.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">Nothing here</p>
        ) : (
          section.items.map((item) => <TaskCard key={item.id} item={item} />)
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npm test -- --testPathPattern="TaskCard|StatusLane"
```

Expected: `Tests: 7 passed, 7 total`

- [ ] **Step 6: Commit**

```bash
git add components/dashboard/TaskCard.tsx components/dashboard/StatusLane.tsx __tests__/components/dashboard/
git commit -m "feat: add TaskCard and StatusLane dashboard components with tests"
```

---

### Task 6: Dashboard page

**Files:**
- Create: `app/(client)/dashboard/page.tsx`

- [ ] **Step 1: Create the dashboard page directory**

```bash
mkdir -p "app/(client)/dashboard"
```

- [ ] **Step 2: Create dashboard/page.tsx**

```tsx
// app/(client)/dashboard/page.tsx
import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { getClientByEmail, getClientTasks } from "@/lib/airtable"
import { processTasks, DashboardData } from "@/lib/claude"
import StatusLane from "@/components/dashboard/StatusLane"

const LANE_COLORS: ("red" | "yellow" | "green")[] = ["red", "yellow", "green"]

export default async function DashboardPage() {
  const session = await auth()
  if (!session?.user?.email) redirect("/login")

  const client = await getClientByEmail(session.user.email)
  if (!client) redirect("/login")

  let dashboard: DashboardData
  try {
    const tasks = await getClientTasks(client.clientBaseId)
    const today = new Date().toISOString().split("T")[0]
    dashboard = await processTasks(tasks, today)
  } catch {
    dashboard = {
      sections: [
        { title: "Outstanding Documents", items: [] },
        { title: "In Progress", items: [] },
        { title: "Completed", items: [] },
      ],
    }
  }

  const overdueCount = dashboard.sections
    .flatMap((s) => s.items)
    .filter((i) => i.overdue).length

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">
          {overdueCount > 0 ? (
            <span className="text-red-600 font-medium">
              {overdueCount} overdue item{overdueCount !== 1 ? "s" : ""} — please respond promptly
            </span>
          ) : (
            "Your case items"
          )}
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {dashboard.sections.map((section, i) => (
          <StatusLane key={section.title} section={section} color={LANE_COLORS[i]} />
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add "app/(client)/dashboard/page.tsx"
git commit -m "feat: add dashboard page with three-lane Claude-powered layout"
```

---

### Task 7: AirtableEmbed component + embedded view pages

**Files:**
- Create: `components/ui/AirtableEmbed.tsx`
- Create: `app/(client)/pleadings/page.tsx`
- Create: `app/(client)/discovery/page.tsx`
- Create: `app/(client)/calendar/page.tsx`
- Create: `__tests__/components/ui/AirtableEmbed.test.tsx`

- [ ] **Step 1: Write the failing test**

```bash
mkdir -p __tests__/components/ui
```

Create `__tests__/components/ui/AirtableEmbed.test.tsx`:
```tsx
import { render, screen } from "@testing-library/react"
import AirtableEmbed from "@/components/ui/AirtableEmbed"

describe("AirtableEmbed", () => {
  it("renders iframe with correct src", () => {
    render(<AirtableEmbed url="https://airtable.com/embed/test" title="Pleadings" />)
    const iframe = screen.getByTitle("Pleadings")
    expect(iframe).toHaveAttribute("src", "https://airtable.com/embed/test")
  })

  it("renders fallback link", () => {
    render(<AirtableEmbed url="https://airtable.com/embed/test" title="Pleadings" />)
    const link = screen.getByRole("link", { name: /open pleadings/i })
    expect(link).toHaveAttribute("href", "https://airtable.com/embed/test")
    expect(link).toHaveAttribute("target", "_blank")
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- --testPathPattern="AirtableEmbed"
```

Expected: FAIL — `Cannot find module '@/components/ui/AirtableEmbed'`

- [ ] **Step 3: Create AirtableEmbed component**

```bash
mkdir -p components/ui
```

```tsx
// components/ui/AirtableEmbed.tsx
interface AirtableEmbedProps {
  url: string
  title: string
}

export default function AirtableEmbed({ url, title }: AirtableEmbedProps) {
  if (!url) {
    return (
      <div className="flex items-center justify-center h-96 bg-gray-50 rounded-lg border border-gray-200">
        <p className="text-sm text-gray-400">View not configured. Contact your attorney.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Desktop: iframe */}
      <div className="hidden md:block rounded-lg overflow-hidden border border-gray-200 shadow-sm">
        <iframe
          src={url}
          title={title}
          width="100%"
          height="600"
          className="block"
          frameBorder="0"
          allowFullScreen
        />
      </div>

      {/* Mobile: fallback link */}
      <div className="md:hidden">
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Open {title} ↗
        </a>
      </div>

      {/* Always show open-in-new-tab link */}
      <p className="text-xs text-gray-400">
        <a href={url} target="_blank" rel="noopener noreferrer" className="hover:underline">
          Open {title} in new tab ↗
        </a>
      </p>
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- --testPathPattern="AirtableEmbed"
```

Expected: `Tests: 2 passed, 2 total`

- [ ] **Step 5: Create pleadings, discovery, calendar pages**

```bash
mkdir -p "app/(client)/pleadings" "app/(client)/discovery" "app/(client)/calendar"
```

```tsx
// app/(client)/pleadings/page.tsx
import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { getClientByEmail } from "@/lib/airtable"
import AirtableEmbed from "@/components/ui/AirtableEmbed"

export default async function PleadingsPage() {
  const session = await auth()
  if (!session?.user?.email) redirect("/login")
  const client = await getClientByEmail(session.user.email)
  if (!client) redirect("/login")

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Pleadings</h1>
      <AirtableEmbed url={client.pleadingsViewLink} title="Pleadings" />
    </div>
  )
}
```

```tsx
// app/(client)/discovery/page.tsx
import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { getClientByEmail } from "@/lib/airtable"
import AirtableEmbed from "@/components/ui/AirtableEmbed"

export default async function DiscoveryPage() {
  const session = await auth()
  if (!session?.user?.email) redirect("/login")
  const client = await getClientByEmail(session.user.email)
  if (!client) redirect("/login")

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Discovery</h1>
      <AirtableEmbed url={client.discoveryViewLink} title="Discovery" />
    </div>
  )
}
```

```tsx
// app/(client)/calendar/page.tsx
import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { getClientByEmail } from "@/lib/airtable"
import AirtableEmbed from "@/components/ui/AirtableEmbed"

export default async function CalendarPage() {
  const session = await auth()
  if (!session?.user?.email) redirect("/login")
  const client = await getClientByEmail(session.user.email)
  if (!client) redirect("/login")

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Calendar</h1>
      <AirtableEmbed url={client.calendarViewLink} title="Calendar" />
    </div>
  )
}
```

- [ ] **Step 6: Commit**

```bash
git add components/ui/AirtableEmbed.tsx "app/(client)/pleadings/page.tsx" "app/(client)/discovery/page.tsx" "app/(client)/calendar/page.tsx" __tests__/components/ui/AirtableEmbed.test.tsx
git commit -m "feat: add AirtableEmbed component and pleadings/discovery/calendar pages"
```

---

### Task 8: Document Requests page (FileFlow)

**Files:**
- Create: `app/(client)/document-requests/page.tsx`

- [ ] **Step 1: Create the page directory**

```bash
mkdir -p "app/(client)/document-requests"
```

- [ ] **Step 2: Create document-requests/page.tsx**

```tsx
// app/(client)/document-requests/page.tsx
import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { getClientByEmail } from "@/lib/airtable"

export default async function DocumentRequestsPage() {
  const session = await auth()
  if (!session?.user?.email) redirect("/login")
  const client = await getClientByEmail(session.user.email)
  if (!client) redirect("/login")

  const url = client.fileflowLink

  if (!url) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">Document Requests</h1>
        <div className="flex items-center justify-center h-64 bg-gray-50 rounded-lg border border-gray-200">
          <p className="text-sm text-gray-500">Document portal not configured. Please contact your attorney.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Document Requests</h1>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-blue-600 hover:underline"
        >
          Open in new tab ↗
        </a>
      </div>

      {/* Desktop: embedded iframe */}
      <div className="hidden md:block rounded-lg overflow-hidden border border-gray-200 shadow-sm">
        <iframe
          src={url}
          title="Document Requests"
          width="100%"
          height="700"
          className="block"
          frameBorder="0"
        />
      </div>

      {/* Mobile: full-width button */}
      <div className="md:hidden">
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="block w-full text-center px-6 py-4 bg-blue-600 text-white rounded-xl font-medium text-lg hover:bg-blue-700 transition-colors"
        >
          Open Document Portal ↗
        </a>
        <p className="mt-3 text-sm text-gray-500 text-center">
          Upload and manage your requested documents
        </p>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add "app/(client)/document-requests/page.tsx"
git commit -m "feat: add document requests page with FileFlow iframe and mobile fallback"
```

---

### Task 9: Messages API route + client messages page

**Files:**
- Create: `app/api/messages/route.ts`
- Create: `app/(client)/messages/page.tsx`
- Create: `__tests__/api/messages.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `__tests__/api/messages.test.ts`:
```typescript
import { GET } from "@/app/api/messages/route"

jest.mock("@/auth", () => ({ auth: jest.fn() }))
jest.mock("@/lib/airtable", () => ({ getClientByEmail: jest.fn() }))
jest.mock("@/lib/db", () => ({ sql: jest.fn() }))

import { auth } from "@/auth"
import { getClientByEmail } from "@/lib/airtable"
import { sql } from "@/lib/db"

const mockAuth = auth as jest.Mock
const mockGetClient = getClientByEmail as jest.Mock
const mockSql = sql as unknown as jest.Mock

beforeEach(() => {
  jest.clearAllMocks()
})

describe("GET /api/messages", () => {
  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValueOnce(null)
    const req = new Request("http://localhost/api/messages")
    const res = await GET(req)
    expect(res.status).toBe(401)
  })

  it("returns messages for authenticated client", async () => {
    mockAuth.mockResolvedValueOnce({ user: { email: "client@test.com" } })
    mockGetClient.mockResolvedValueOnce({ clientId: "C001" })
    mockSql.mockResolvedValueOnce({
      rows: [
        { id: "uuid-1", body: "Please submit your tax returns.", created_at: "2026-03-01T10:00:00Z", read: false },
      ],
    })
    const req = new Request("http://localhost/api/messages")
    const res = await GET(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.messages).toHaveLength(1)
    expect(body.messages[0].body).toBe("Please submit your tax returns.")
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- --testPathPattern="messages"
```

Expected: FAIL — `Cannot find module '@/app/api/messages/route'`

- [ ] **Step 3: Create messages API route**

```bash
mkdir -p app/api/messages
```

```typescript
// app/api/messages/route.ts
import { auth } from "@/auth"
import { getClientByEmail } from "@/lib/airtable"
import { sql } from "@/lib/db"
import { NextResponse } from "next/server"

export async function GET() {
  const session = await auth()
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const client = await getClientByEmail(session.user.email)
  if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 })

  // Mark all unread messages as read
  await sql`
    UPDATE messages SET read = true
    WHERE client_id = ${client.clientId} AND read = false
  `

  const result = await sql`
    SELECT id, body, created_at, read
    FROM messages
    WHERE client_id = ${client.clientId}
    ORDER BY created_at DESC
    LIMIT 50
  `

  return NextResponse.json({ messages: result.rows })
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- --testPathPattern="messages"
```

Expected: `Tests: 2 passed, 2 total`

- [ ] **Step 5: Create messages page**

```bash
mkdir -p "app/(client)/messages"
```

```tsx
// app/(client)/messages/page.tsx
import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { getClientByEmail } from "@/lib/airtable"
import { sql } from "@/lib/db"

interface Message {
  id: string
  body: string
  created_at: string
  read: boolean
}

function formatDateTime(ts: string): string {
  return new Date(ts).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

export default async function MessagesPage() {
  const session = await auth()
  if (!session?.user?.email) redirect("/login")

  const client = await getClientByEmail(session.user.email)
  if (!client) redirect("/login")

  // Mark unread as read
  await sql`
    UPDATE messages SET read = true
    WHERE client_id = ${client.clientId} AND read = false
  `

  const result = await sql`
    SELECT id, body, created_at
    FROM messages
    WHERE client_id = ${client.clientId}
    ORDER BY created_at DESC
    LIMIT 50
  `

  const messages: Message[] = result.rows

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900">Messages</h1>
      {messages.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <p>No messages yet.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {messages.map((msg) => (
            <div key={msg.id} className="bg-white rounded-lg border border-gray-200 p-5 shadow-sm">
              <p className="text-gray-800 whitespace-pre-wrap">{msg.body}</p>
              <p className="mt-3 text-xs text-gray-400">{formatDateTime(msg.created_at)}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 6: Commit**

```bash
git add app/api/messages/route.ts "app/(client)/messages/page.tsx" __tests__/api/messages.test.ts
git commit -m "feat: add messages API route and client messages page"
```

---

### Task 10: Chat API route + client chat page

**Files:**
- Create: `app/api/chat/route.ts`
- Create: `components/chat/ChatThread.tsx`
- Create: `components/chat/ChatInput.tsx`
- Create: `app/(client)/chat/page.tsx`
- Create: `__tests__/api/chat.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `__tests__/api/chat.test.ts`:
```typescript
import { GET, POST } from "@/app/api/chat/route"

jest.mock("@/auth", () => ({ auth: jest.fn() }))
jest.mock("@/lib/airtable", () => ({ getClientByEmail: jest.fn() }))
jest.mock("@/lib/db", () => ({ sql: jest.fn() }))

import { auth } from "@/auth"
import { getClientByEmail } from "@/lib/airtable"
import { sql } from "@/lib/db"

const mockAuth = auth as jest.Mock
const mockGetClient = getClientByEmail as jest.Mock
const mockSql = sql as unknown as jest.Mock

beforeEach(() => {
  jest.clearAllMocks()
  mockAuth.mockResolvedValue({ user: { email: "client@test.com" } })
  mockGetClient.mockResolvedValue({ clientId: "C001" })
})

describe("GET /api/chat", () => {
  it("returns chat messages", async () => {
    mockSql
      .mockResolvedValueOnce({ rows: [] }) // mark read
      .mockResolvedValueOnce({
        rows: [{ id: "uuid-1", sender: "firm", body: "Hello!", created_at: "2026-03-01T10:00:00Z" }],
      })
    const req = new Request("http://localhost/api/chat")
    const res = await GET(req)
    const body = await res.json()
    expect(body.messages).toHaveLength(1)
  })
})

describe("POST /api/chat", () => {
  it("saves a client message", async () => {
    mockSql.mockResolvedValueOnce({ rows: [{ id: "new-uuid", sender: "client", body: "Hi", created_at: new Date().toISOString() }] })
    const req = new Request("http://localhost/api/chat", {
      method: "POST",
      body: JSON.stringify({ body: "Hi" }),
    })
    const res = await POST(req)
    expect(res.status).toBe(201)
  })

  it("rejects empty message body", async () => {
    const req = new Request("http://localhost/api/chat", {
      method: "POST",
      body: JSON.stringify({ body: "" }),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- --testPathPattern="chat.test"
```

Expected: FAIL — `Cannot find module '@/app/api/chat/route'`

- [ ] **Step 3: Create chat API route**

```bash
mkdir -p app/api/chat
```

```typescript
// app/api/chat/route.ts
import { auth } from "@/auth"
import { getClientByEmail } from "@/lib/airtable"
import { sql } from "@/lib/db"
import { NextResponse } from "next/server"

export async function GET() {
  const session = await auth()
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const client = await getClientByEmail(session.user.email)
  if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 })

  // Mark firm messages as read
  await sql`
    UPDATE chat_messages SET read = true
    WHERE client_id = ${client.clientId} AND sender = 'firm' AND read = false
  `

  const result = await sql`
    SELECT id, sender, body, created_at
    FROM chat_messages
    WHERE client_id = ${client.clientId}
    ORDER BY created_at ASC
    LIMIT 100
  `

  return NextResponse.json({ messages: result.rows })
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const client = await getClientByEmail(session.user.email)
  if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 })

  const { body } = await req.json()
  if (!body || typeof body !== "string" || body.trim().length === 0) {
    return NextResponse.json({ error: "Message body is required" }, { status: 400 })
  }

  const result = await sql`
    INSERT INTO chat_messages (client_id, sender, body)
    VALUES (${client.clientId}, 'client', ${body.trim()})
    RETURNING id, sender, body, created_at
  `

  return NextResponse.json({ message: result.rows[0] }, { status: 201 })
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- --testPathPattern="chat.test"
```

Expected: `Tests: 3 passed, 3 total`

- [ ] **Step 5: Create ChatThread and ChatInput components**

```bash
mkdir -p components/chat
```

```tsx
// components/chat/ChatThread.tsx
"use client"

import { useEffect, useRef } from "react"

interface ChatMessage {
  id: string
  sender: "client" | "firm"
  body: string
  created_at: string
}

interface ChatThreadProps {
  messages: ChatMessage[]
}

function formatTime(ts: string): string {
  return new Date(ts).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
}

export default function ChatThread({ messages }: ChatThreadProps) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  return (
    <div className="flex flex-col gap-4 py-4">
      {messages.length === 0 && (
        <p className="text-center text-sm text-gray-400 py-8">No messages yet. Say hello!</p>
      )}
      {messages.map((msg) => (
        <div
          key={msg.id}
          className={`flex ${msg.sender === "client" ? "justify-end" : "justify-start"}`}
        >
          <div
            className={`max-w-sm px-4 py-2.5 rounded-2xl text-sm ${
              msg.sender === "client"
                ? "bg-blue-600 text-white rounded-br-sm"
                : "bg-white border border-gray-200 text-gray-900 rounded-bl-sm"
            }`}
          >
            <p className="whitespace-pre-wrap">{msg.body}</p>
            <p className={`text-xs mt-1 ${msg.sender === "client" ? "text-blue-200" : "text-gray-400"}`}>
              {formatTime(msg.created_at)}
            </p>
          </div>
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  )
}
```

```tsx
// components/chat/ChatInput.tsx
"use client"

import { useState, KeyboardEvent } from "react"

interface ChatInputProps {
  onSend: (body: string) => Promise<void>
}

export default function ChatInput({ onSend }: ChatInputProps) {
  const [value, setValue] = useState("")
  const [sending, setSending] = useState(false)

  async function handleSend() {
    const trimmed = value.trim()
    if (!trimmed || sending) return
    setSending(true)
    await onSend(trimmed)
    setValue("")
    setSending(false)
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="flex gap-3 items-end border-t border-gray-200 pt-4">
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Type a message... (Enter to send)"
        rows={2}
        className="flex-1 resize-none px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      <button
        onClick={handleSend}
        disabled={!value.trim() || sending}
        className="px-5 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
      >
        Send
      </button>
    </div>
  )
}
```

- [ ] **Step 6: Create chat page**

```bash
mkdir -p "app/(client)/chat"
```

```tsx
// app/(client)/chat/page.tsx
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

export default function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([])

  const fetchMessages = useCallback(async () => {
    const res = await fetch("/api/chat")
    if (res.ok) {
      const data = await res.json()
      setMessages(data.messages)
    }
  }, [])

  useEffect(() => {
    fetchMessages()
    // Poll every 60 seconds for new messages from firm
    const interval = setInterval(fetchMessages, 60_000)
    return () => clearInterval(interval)
  }, [fetchMessages])

  async function handleSend(body: string) {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body }),
    })
    if (res.ok) {
      const data = await res.json()
      setMessages((prev) => [...prev, data.message])
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-4">Chat</h1>
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

- [ ] **Step 7: Run all tests**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 8: Commit**

```bash
git add app/api/chat/route.ts components/chat/ "app/(client)/chat/page.tsx" __tests__/api/chat.test.ts
git commit -m "feat: add chat API route, components, and client chat page"
```

---

### Task 11: Build verification

- [ ] **Step 1: Run a production build to catch TypeScript/import errors**

```bash
npm run build
```

Expected: build completes with no errors. Note any warnings but do not fail on warnings.

- [ ] **Step 2: Run full test suite**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 3: Final commit for Plan 2**

```bash
git add .
git commit -m "feat: Plan 2 complete — all client portal pages"
```

---

## Plan 2 Complete

All client-facing pages are built. The next plan (Plan 3) adds the admin interface and smart reminder cron job.

**Before starting Plan 3, verify manually:**
- [ ] `npm run build` passes
- [ ] `/login` → Google OAuth redirects correctly
- [ ] `/dashboard` shows the three-lane layout
- [ ] `/document-requests` shows FileFlow iframe on desktop
- [ ] `/pleadings`, `/discovery`, `/calendar` show Airtable embeds
- [ ] `/messages` shows the messages inbox
- [ ] `/chat` sends and receives messages
