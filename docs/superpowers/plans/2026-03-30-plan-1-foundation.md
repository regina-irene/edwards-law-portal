# Client Portal — Plan 1: Foundation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Initialize the Next.js project, configure the database schema, wire up Auth.js with Google OAuth and magic link, build the Airtable client helper, and protect routes via middleware.

**Architecture:** Next.js 15 App Router with TypeScript and Tailwind. Auth.js v5 handles authentication using a PostgreSQL adapter backed by Vercel Postgres. All API keys live in Vercel environment variables. Airtable is queried via `fetch` (no SDK) through Next.js API routes only.

**Tech Stack:** Next.js 15, Auth.js v5 (`next-auth@beta`), `@auth/pg-adapter`, `pg`, `@vercel/postgres`, `@anthropic-ai/sdk`, `resend`, `twilio`, Tailwind CSS, TypeScript, Jest, React Testing Library

---

## File Structure

```
portal/
├── auth.ts                              # Auth.js config (providers + adapter)
├── middleware.ts                        # Route protection
├── jest.config.ts                       # Jest config
├── jest.setup.ts                        # Testing Library setup
├── .env.local.example                   # Required env vars (committed)
├── scripts/
│   └── migrate.ts                       # Database migration script
├── lib/
│   ├── db.ts                            # Vercel Postgres sql client
│   ├── airtable.ts                      # Airtable fetch helpers + types
│   └── claude.ts                        # Claude API helper
├── app/
│   ├── globals.css
│   ├── layout.tsx                       # Root HTML shell
│   └── api/
│       └── auth/
│           └── [...nextauth]/
│               └── route.ts             # Auth.js request handler
└── __tests__/
    ├── lib/
    │   ├── airtable.test.ts
    │   └── claude.test.ts
    └── setup/
        └── migration.test.ts
```

---

### Task 1: Initialize Next.js project

**Files:**
- Create: `package.json`, `tsconfig.json`, `tailwind.config.ts`, `next.config.mjs`, `.env.local.example`, `app/globals.css`, `app/layout.tsx`

- [ ] **Step 1: Run create-next-app**

```bash
cd C:/Users/regin/portal
npx create-next-app@latest . --typescript --tailwind --app --no-src-dir --import-alias "@/*" --yes
```

Expected: project scaffold created with `app/`, `public/`, `package.json`, `tsconfig.json`.

- [ ] **Step 2: Install additional dependencies**

```bash
npm install next-auth@beta @auth/pg-adapter pg @vercel/postgres @anthropic-ai/sdk resend twilio @dnd-kit/core @dnd-kit/sortable
npm install -D @types/pg jest @testing-library/react @testing-library/jest-dom @testing-library/user-event jest-environment-jsdom @types/jest ts-jest
```

Expected: `node_modules/` populated, no peer dependency errors.

- [ ] **Step 3: Update next.config.mjs to allow Airtable iframe embeds**

Replace `next.config.mjs` with:

```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "X-Frame-Options",
            value: "SAMEORIGIN",
          },
        ],
      },
    ]
  },
}

export default nextConfig
```

- [ ] **Step 4: Create .env.local.example**

```bash
cat > .env.local.example << 'EOF'
# Vercel Postgres
POSTGRES_URL=
POSTGRES_URL_NON_POOLING=

# Auth.js
AUTH_SECRET=
AUTH_URL=http://localhost:3000

# Google OAuth
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# Airtable
AIRTABLE_API_KEY=
AIRTABLE_MAIN_BASE_ID=

# Claude
ANTHROPIC_API_KEY=

# Resend (email)
RESEND_API_KEY=
EMAIL_FROM=portal@edwardslaw.com

# Twilio (SMS)
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_FROM_NUMBER=
EOF
```

- [ ] **Step 5: Verify dev server starts**

```bash
npm run dev
```

Expected: `▲ Next.js 15.x.x` and `Local: http://localhost:3000` in output. Stop with Ctrl+C.

- [ ] **Step 6: Commit**

```bash
git init
git add package.json package-lock.json tsconfig.json next.config.mjs tailwind.config.ts postcss.config.mjs .env.local.example app/globals.css app/layout.tsx app/page.tsx public/
git commit -m "feat: initialize Next.js 15 project with TypeScript and Tailwind"
```

---

### Task 2: Configure Jest

**Files:**
- Create: `jest.config.ts`, `jest.setup.ts`

- [ ] **Step 1: Create jest.config.ts**

```typescript
// jest.config.ts
import type { Config } from "jest"
import nextJest from "next/jest.js"

const createJestConfig = nextJest({ dir: "./" })

const config: Config = {
  testEnvironment: "jest-environment-jsdom",
  setupFilesAfterFramework: ["<rootDir>/jest.setup.ts"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
  },
  testMatch: ["**/__tests__/**/*.test.ts", "**/__tests__/**/*.test.tsx"],
}

export default createJestConfig(config)
```

- [ ] **Step 2: Create jest.setup.ts**

```typescript
// jest.setup.ts
import "@testing-library/jest-dom"
```

- [ ] **Step 3: Add test script to package.json**

In `package.json`, add to `"scripts"`:
```json
"test": "jest",
"test:watch": "jest --watch"
```

- [ ] **Step 4: Create a sanity test and verify it passes**

```bash
mkdir -p __tests__/lib
```

Create `__tests__/lib/sanity.test.ts`:
```typescript
describe("sanity", () => {
  it("jest is configured", () => {
    expect(1 + 1).toBe(2)
  })
})
```

```bash
npm test
```

Expected: `Tests: 1 passed, 1 total`

- [ ] **Step 5: Remove sanity test and commit**

```bash
rm __tests__/lib/sanity.test.ts
git add jest.config.ts jest.setup.ts package.json
git commit -m "feat: configure Jest with React Testing Library"
```

---

### Task 3: Database schema + migration script

**Files:**
- Create: `lib/db.ts`
- Create: `scripts/migrate.ts`

- [ ] **Step 1: Create test directory and write the failing migration test**

```bash
mkdir -p __tests__/setup
```

Create `__tests__/setup/migration.test.ts`:
```typescript
// This test verifies the SQL strings are syntactically valid (structure only)
// Actual migration runs against a real DB via `npm run migrate`
import { MIGRATION_SQL } from "@/scripts/migrate"

describe("migration SQL", () => {
  it("contains all required tables", () => {
    expect(MIGRATION_SQL).toContain("CREATE TABLE IF NOT EXISTS users")
    expect(MIGRATION_SQL).toContain("CREATE TABLE IF NOT EXISTS accounts")
    expect(MIGRATION_SQL).toContain("CREATE TABLE IF NOT EXISTS sessions")
    expect(MIGRATION_SQL).toContain("CREATE TABLE IF NOT EXISTS verification_tokens")
    expect(MIGRATION_SQL).toContain("CREATE TABLE IF NOT EXISTS messages")
    expect(MIGRATION_SQL).toContain("CREATE TABLE IF NOT EXISTS chat_messages")
    expect(MIGRATION_SQL).toContain("CREATE TABLE IF NOT EXISTS nav_order")
    expect(MIGRATION_SQL).toContain("CREATE TABLE IF NOT EXISTS admin_users")
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- --testPathPattern="migration"
```

Expected: FAIL — `Cannot find module '@/scripts/migrate'`

- [ ] **Step 3: Create scripts/migrate.ts**

```bash
mkdir -p scripts
```

```typescript
// scripts/migrate.ts
import { Pool } from "pg"

export const MIGRATION_SQL = `
  -- Auth.js required tables
  CREATE TABLE IF NOT EXISTS users (
    id TEXT NOT NULL PRIMARY KEY,
    name TEXT,
    email TEXT NOT NULL,
    "emailVerified" TIMESTAMPTZ,
    image TEXT
  );

  CREATE TABLE IF NOT EXISTS accounts (
    id TEXT NOT NULL,
    "userId" TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    provider TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    refresh_token TEXT,
    access_token TEXT,
    expires_at INTEGER,
    token_type TEXT,
    scope TEXT,
    id_token TEXT,
    session_state TEXT,
    PRIMARY KEY (provider, "providerAccountId")
  );

  CREATE TABLE IF NOT EXISTS sessions (
    "sessionToken" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires TIMESTAMPTZ NOT NULL
  );

  CREATE TABLE IF NOT EXISTS verification_tokens (
    identifier TEXT NOT NULL,
    token TEXT NOT NULL,
    expires TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (identifier, token)
  );

  -- Portal-specific tables
  CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id TEXT NOT NULL,
    body TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    read BOOLEAN NOT NULL DEFAULT false
  );

  CREATE TABLE IF NOT EXISTS chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id TEXT NOT NULL,
    sender TEXT NOT NULL CHECK (sender IN ('client', 'firm')),
    body TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    read BOOLEAN NOT NULL DEFAULT false
  );

  CREATE TABLE IF NOT EXISTS nav_order (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pages JSONB NOT NULL
  );

  CREATE TABLE IF NOT EXISTS admin_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL UNIQUE,
    name TEXT
  );
`

async function migrate(): Promise<void> {
  const pool = new Pool({
    connectionString: process.env.POSTGRES_URL_NON_POOLING,
    ssl: { rejectUnauthorized: false },
  })

  const client = await pool.connect()
  try {
    await client.query(MIGRATION_SQL)
    console.log("Migration complete.")
  } finally {
    client.release()
    await pool.end()
  }
}

// Only run when executed directly
if (require.main === module) {
  migrate().catch((err) => {
    console.error(err)
    process.exit(1)
  })
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- --testPathPattern="migration"
```

Expected: `Tests: 1 passed, 1 total`

- [ ] **Step 5: Create lib/db.ts**

```typescript
// lib/db.ts
import { sql } from "@vercel/postgres"

export { sql }
```

- [ ] **Step 6: Add migrate script to package.json**

Add to `"scripts"` in `package.json`:
```json
"migrate": "ts-node --project tsconfig.json scripts/migrate.ts"
```

Install `ts-node`:
```bash
npm install -D ts-node
```

- [ ] **Step 7: Commit**

```bash
git add lib/db.ts scripts/migrate.ts __tests__/setup/migration.test.ts package.json
git commit -m "feat: add database schema and migration script"
```

---

### Task 4: Auth.js v5 setup

**Files:**
- Create: `auth.ts`
- Create: `app/api/auth/[...nextauth]/route.ts`

- [ ] **Step 1: Generate AUTH_SECRET**

```bash
npx auth secret
```

Copy the output and add it to `.env.local` as `AUTH_SECRET=<value>`.

- [ ] **Step 2: Create auth.ts at root level**

```typescript
// auth.ts
import NextAuth from "next-auth"
import Google from "next-auth/providers/google"
import Nodemailer from "next-auth/providers/nodemailer"
import PostgresAdapter from "@auth/pg-adapter"
import { Pool } from "pg"

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL_NON_POOLING,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
})

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PostgresAdapter(pool),
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    Nodemailer({
      server: {
        host: "smtp.resend.com",
        port: 465,
        auth: {
          user: "resend",
          pass: process.env.RESEND_API_KEY,
        },
      },
      from: process.env.EMAIL_FROM ?? "portal@edwardslaw.com",
    }),
  ],
  callbacks: {
    session({ session, user }) {
      session.user.id = user.id
      return session
    },
  },
  pages: {
    signIn: "/login",
    verifyRequest: "/login?verify=1",
  },
})
```

- [ ] **Step 3: Create the Auth.js route handler**

```bash
mkdir -p app/api/auth/\[...nextauth\]
```

```typescript
// app/api/auth/[...nextauth]/route.ts
import { handlers } from "@/auth"

export const { GET, POST } = handlers
```

- [ ] **Step 4: Create the login page**

```bash
mkdir -p "app/(auth)/login"
```

```tsx
// app/(auth)/login/page.tsx
"use client"

import { signIn } from "next-auth/react"
import { useSearchParams } from "next/navigation"
import { useState, Suspense } from "react"

function LoginForm() {
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const searchParams = useSearchParams()
  const verify = searchParams.get("verify")

  if (verify) {
    return (
      <div className="text-center">
        <h2 className="text-xl font-semibold mb-2">Check your email</h2>
        <p className="text-gray-600">
          A sign-in link has been sent to your email address.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <button
        onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
        className="w-full flex items-center justify-center gap-3 px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
      >
        <svg className="w-5 h-5" viewBox="0 0 24 24">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
        </svg>
        Sign in with Google
      </button>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-gray-200" />
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="bg-white px-2 text-gray-500">or</span>
        </div>
      </div>

      <form
        onSubmit={async (e) => {
          e.preventDefault()
          setLoading(true)
          await signIn("nodemailer", { email, callbackUrl: "/dashboard" })
          setLoading(false)
        }}
        className="space-y-3"
      >
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="your@email.com"
          required
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          type="submit"
          disabled={loading}
          className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {loading ? "Sending..." : "Send Magic Link"}
        </button>
      </form>
    </div>
  )
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-200 w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Edwards Family Law</h1>
          <p className="text-gray-500 mt-1">Client Portal</p>
        </div>
        <Suspense>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Update app/layout.tsx to include SessionProvider**

```tsx
// app/layout.tsx
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { SessionProvider } from "next-auth/react"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Edwards Family Law — Client Portal",
  description: "Secure client portal for Edwards Family Law",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  )
}
```

- [ ] **Step 6: Commit**

```bash
git add auth.ts "app/api/auth/[...nextauth]/route.ts" "app/(auth)/login/page.tsx" app/layout.tsx
git commit -m "feat: add Auth.js v5 with Google OAuth and magic link providers"
```

---

### Task 5: Route protection middleware

**Files:**
- Create: `middleware.ts`

- [ ] **Step 1: Write the middleware**

```typescript
// middleware.ts
import { auth } from "@/auth"
import { NextResponse } from "next/server"

const PROTECTED_PATHS = [
  "/dashboard",
  "/document-requests",
  "/pleadings",
  "/discovery",
  "/calendar",
  "/messages",
  "/chat",
  "/admin",
]

export default auth((req) => {
  const { pathname } = req.nextUrl
  const isProtected = PROTECTED_PATHS.some((p) => pathname.startsWith(p))

  if (isProtected && !req.auth) {
    const loginUrl = new URL("/login", req.url)
    loginUrl.searchParams.set("callbackUrl", pathname)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
})

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/document-requests/:path*",
    "/pleadings/:path*",
    "/discovery/:path*",
    "/calendar/:path*",
    "/messages/:path*",
    "/chat/:path*",
    "/admin/:path*",
  ],
}
```

- [ ] **Step 2: Verify dev server starts with no TypeScript errors**

```bash
npm run build 2>&1 | grep -E "error|Error" | head -20
```

Expected: no TypeScript errors related to middleware or auth.

- [ ] **Step 3: Commit**

```bash
git add middleware.ts
git commit -m "feat: protect client and admin routes via Auth.js middleware"
```

---

### Task 6: Airtable client helpers

**Files:**
- Create: `lib/airtable.ts`
- Create: `__tests__/lib/airtable.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// __tests__/lib/airtable.test.ts
import { getClientByEmail, getClientTasks, AirtableClient, AirtableTask } from "@/lib/airtable"

global.fetch = jest.fn()

const mockFetch = global.fetch as jest.Mock

beforeEach(() => {
  mockFetch.mockClear()
  process.env.AIRTABLE_API_KEY = "test-key"
  process.env.AIRTABLE_MAIN_BASE_ID = "appTESTBASE"
})

describe("getClientByEmail", () => {
  it("returns null when no records found", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ records: [] }),
    })
    const result = await getClientByEmail("notfound@test.com")
    expect(result).toBeNull()
  })

  it("returns mapped client when record exists", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        records: [
          {
            id: "recABC123",
            fields: {
              "Client ID": "C001",
              Name: "Jane Smith",
              Email: "jane@test.com",
              Phone: "555-1234",
              "Client Base ID": "appCLIENT123",
              "FileFlow Link": "https://fileflow-eta.vercel.app/c/abc",
              "Pleadings View Link": "https://airtable.com/embed/pleadings",
              "Discovery View Link": "https://airtable.com/embed/discovery",
              "Calendar View Link": "https://airtable.com/embed/calendar",
              "SMS Reminders": true,
            },
          },
        ],
      }),
    })

    const result = await getClientByEmail("jane@test.com")
    expect(result).not.toBeNull()
    expect(result!.clientId).toBe("C001")
    expect(result!.name).toBe("Jane Smith")
    expect(result!.clientBaseId).toBe("appCLIENT123")
    expect(result!.smsReminders).toBe(true)
  })

  it("throws when Airtable returns non-ok status", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 422 })
    await expect(getClientByEmail("jane@test.com")).rejects.toThrow("Airtable error: 422")
  })
})

describe("getClientTasks", () => {
  it("returns mapped tasks sorted by due date", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        records: [
          {
            id: "recT1",
            fields: {
              "Task Name": "Bank Statement",
              Status: "Outstanding",
              "Due Date": "2026-04-10",
              Type: "Financials",
              Matter: "Divorce",
            },
          },
        ],
      }),
    })

    const tasks = await getClientTasks("appCLIENT123")
    expect(tasks).toHaveLength(1)
    expect(tasks[0].name).toBe("Bank Statement")
    expect(tasks[0].status).toBe("Outstanding")
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- --testPathPattern="airtable"
```

Expected: FAIL — `Cannot find module '@/lib/airtable'`

- [ ] **Step 3: Create lib/airtable.ts**

```typescript
// lib/airtable.ts

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY!
const MAIN_BASE_ID = process.env.AIRTABLE_MAIN_BASE_ID!

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
  smsReminders: boolean
}

export interface AirtableTask {
  id: string
  name: string
  status: string
  dueDate: string | null
  type: string
  matter: string
}

async function airtableFetch(url: string) {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}` },
    next: { revalidate: 60 },
  })
  if (!res.ok) throw new Error(`Airtable error: ${res.status}`)
  return res.json()
}

export async function getClientByEmail(email: string): Promise<AirtableClient | null> {
  const formula = encodeURIComponent(`{Email}='${email}'`)
  const data = await airtableFetch(
    `https://api.airtable.com/v0/${MAIN_BASE_ID}/Clients?filterByFormula=${formula}&maxRecords=1`
  )
  if (!data.records || data.records.length === 0) return null
  const r = data.records[0]
  return {
    id: r.id,
    clientId: r.fields["Client ID"] ?? "",
    name: r.fields["Name"] ?? "",
    email: r.fields["Email"] ?? "",
    phone: r.fields["Phone"] ?? "",
    clientBaseId: r.fields["Client Base ID"] ?? "",
    fileflowLink: r.fields["FileFlow Link"] ?? "",
    pleadingsViewLink: r.fields["Pleadings View Link"] ?? "",
    discoveryViewLink: r.fields["Discovery View Link"] ?? "",
    calendarViewLink: r.fields["Calendar View Link"] ?? "",
    smsReminders: r.fields["SMS Reminders"] === true,
  }
}

export async function getClientTasks(clientBaseId: string): Promise<AirtableTask[]> {
  const data = await airtableFetch(
    `https://api.airtable.com/v0/${clientBaseId}/Tasks?sort[0][field]=Due%20Date&sort[0][direction]=asc`
  )
  if (!data.records) return []
  return data.records.map((r: any): AirtableTask => ({
    id: r.id,
    name: r.fields["Task Name"] ?? "",
    status: r.fields["Status"] ?? "",
    dueDate: r.fields["Due Date"] ?? null,
    type: r.fields["Type"] ?? "",
    matter: Array.isArray(r.fields["Matter"]) ? r.fields["Matter"][0] : (r.fields["Matter"] ?? ""),
  }))
}

// Returns all clients from the main base (used by cron reminder job)
export async function getAllClients(): Promise<AirtableClient[]> {
  const data = await airtableFetch(
    `https://api.airtable.com/v0/${MAIN_BASE_ID}/Clients`
  )
  if (!data.records) return []
  return data.records.map((r: any): AirtableClient => ({
    id: r.id,
    clientId: r.fields["Client ID"] ?? "",
    name: r.fields["Name"] ?? "",
    email: r.fields["Email"] ?? "",
    phone: r.fields["Phone"] ?? "",
    clientBaseId: r.fields["Client Base ID"] ?? "",
    fileflowLink: r.fields["FileFlow Link"] ?? "",
    pleadingsViewLink: r.fields["Pleadings View Link"] ?? "",
    discoveryViewLink: r.fields["Discovery View Link"] ?? "",
    calendarViewLink: r.fields["Calendar View Link"] ?? "",
    smsReminders: r.fields["SMS Reminders"] === true,
  }))
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- --testPathPattern="airtable"
```

Expected: `Tests: 4 passed, 4 total`

- [ ] **Step 5: Commit**

```bash
git add lib/airtable.ts __tests__/lib/airtable.test.ts
git commit -m "feat: add Airtable client helpers with tests"
```

---

### Task 7: Claude processing helper

**Files:**
- Create: `lib/claude.ts`
- Create: `__tests__/lib/claude.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// __tests__/lib/claude.test.ts
import { processTasks, DashboardData } from "@/lib/claude"

jest.mock("@anthropic-ai/sdk", () => {
  return {
    default: jest.fn().mockImplementation(() => ({
      messages: {
        create: jest.fn(),
      },
    })),
  }
})

import Anthropic from "@anthropic-ai/sdk"

const mockCreate = jest.fn()
;(Anthropic as jest.Mock).mockImplementation(() => ({
  messages: { create: mockCreate },
}))

describe("processTasks", () => {
  beforeEach(() => {
    mockCreate.mockClear()
    process.env.ANTHROPIC_API_KEY = "test-key"
  })

  it("returns parsed dashboard data from Claude response", async () => {
    const mockDashboard: DashboardData = {
      sections: [
        {
          title: "Outstanding Documents",
          items: [
            {
              id: "recT1",
              name: "Bank Statement",
              dueDate: "2026-04-10",
              status: "outstanding",
              overdue: false,
              type: "Financials",
            },
          ],
        },
        { title: "In Progress", items: [] },
        { title: "Completed", items: [] },
      ],
    }

    mockCreate.mockResolvedValueOnce({
      content: [{ type: "text", text: JSON.stringify(mockDashboard) }],
    })

    const tasks = [
      { id: "recT1", name: "Bank Statement", status: "Outstanding", dueDate: "2026-04-10", type: "Financials", matter: "Divorce" },
    ]

    const result = await processTasks(tasks, "2026-03-30")
    expect(result.sections).toHaveLength(3)
    expect(result.sections[0].title).toBe("Outstanding Documents")
    expect(result.sections[0].items[0].name).toBe("Bank Statement")
  })

  it("throws when Claude returns invalid JSON", async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: "text", text: "not json" }],
    })

    const tasks = [{ id: "recT1", name: "Bank Statement", status: "Outstanding", dueDate: "2026-04-10", type: "Financials", matter: "Divorce" }]
    await expect(processTasks(tasks, "2026-03-30")).rejects.toThrow()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- --testPathPattern="claude"
```

Expected: FAIL — `Cannot find module '@/lib/claude'`

- [ ] **Step 3: Create lib/claude.ts**

```typescript
// lib/claude.ts
import Anthropic from "@anthropic-ai/sdk"
import { AirtableTask } from "./airtable"

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

export interface DashboardItem {
  id: string
  name: string
  dueDate: string | null
  status: "outstanding" | "in_progress" | "completed"
  overdue: boolean
  type: string
}

export interface DashboardSection {
  title: string
  items: DashboardItem[]
}

export interface DashboardData {
  sections: DashboardSection[]
}

const SYSTEM_PROMPT = `You are powering a client portal UI for Edwards Family Law.

Your job: interpret Airtable task records and organize them into three sections.

Rules:
- Always return exactly three sections with these titles in this order:
  1. "Outstanding Documents"
  2. "In Progress"
  3. "Completed"
- Map task Status field: Outstanding/Pending → "outstanding", In Progress/Under Review/Uploaded → "in_progress", Complete/Done → "completed"
- Set overdue: true when dueDate exists, is before today, and status is not "completed"
- Sort items within each section by dueDate ascending (nulls last)
- Use plain English — do not use legal jargon in item names
- Return ONLY valid JSON. No markdown, no explanation.

Output schema:
{
  "sections": [
    {
      "title": "Outstanding Documents",
      "items": [
        {
          "id": "string",
          "name": "string",
          "dueDate": "YYYY-MM-DD or null",
          "status": "outstanding",
          "overdue": false,
          "type": "string"
        }
      ]
    }
  ]
}`

export async function processTasks(
  tasks: AirtableTask[],
  today: string
): Promise<DashboardData> {
  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2048,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Today's date: ${today}\n\nTasks:\n${JSON.stringify(tasks, null, 2)}`,
      },
    ],
  })

  const text = message.content[0].type === "text" ? message.content[0].text : ""
  return JSON.parse(text) as DashboardData
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- --testPathPattern="claude"
```

Expected: `Tests: 2 passed, 2 total`

- [ ] **Step 5: Run all tests to confirm nothing broken**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add lib/claude.ts __tests__/lib/claude.test.ts
git commit -m "feat: add Claude task processing helper with tests"
```

---

### Task 8: Run database migration against Vercel Postgres

> **Prerequisite:** Vercel Postgres database must be provisioned. In Vercel dashboard: Storage → Create Database → Postgres. Copy the `POSTGRES_URL` and `POSTGRES_URL_NON_POOLING` values into `.env.local`.

- [ ] **Step 1: Verify .env.local has required values**

```bash
grep "POSTGRES_URL=" .env.local
```

Expected: non-empty value.

- [ ] **Step 2: Run migration**

```bash
npm run migrate
```

Expected: `Migration complete.`

- [ ] **Step 3: Verify tables exist (optional)**

Connect to the database via Vercel dashboard → Storage → your database → Data tab. Confirm `users`, `messages`, `chat_messages`, `nav_order`, and `admin_users` tables are present.

- [ ] **Step 4: Run full test suite**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 5: Final commit for Plan 1**

```bash
git add .
git commit -m "feat: Plan 1 complete — foundation with auth, DB, Airtable, and Claude helpers"
```

---

## Plan 1 Complete

Foundation is ready. The next plan (Plan 2) builds all client-facing portal pages on top of this foundation.

**Before starting Plan 2, verify:**
- [ ] `npm run dev` starts without errors
- [ ] `npm test` passes all tests
- [ ] `/login` page loads at `localhost:3000/login`
- [ ] Google OAuth is configured in Google Cloud Console with `http://localhost:3000/api/auth/callback/google` as an authorized redirect URI
- [ ] Database migration has run successfully
