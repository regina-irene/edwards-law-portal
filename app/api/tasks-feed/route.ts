// app/api/tasks-feed/route.ts
// ── Read-only to-do feed for the EFL Apps dashboard ──────────────────────────
// Returns open (pending) client tasks for display on the firm's internal
// launcher page (eflapps.tiiny.site), in the same shape as FileFlow's
// /api/tasks-feed so the dashboard can merge both. GET only - nothing can be
// changed through this endpoint.
//
// Auth: callers send the shared dashboard key in the `X-Feed-Key` header.
// Only the SHA-256 hash of the key is stored here, so the repo never contains
// the key itself. Same key as FileFlow's feed. To rotate: hash the new key
// with SHA-256 and replace the constant below (or set TASKS_FEED_KEY_SHA256
// in Vercel, which takes precedence).
import { NextRequest, NextResponse } from "next/server"
import { createHash, timingSafeEqual } from "crypto"
import { sql } from "@/lib/db"
import { getAllClients, clientDisplayLabel } from "@/lib/airtable"
import { getClientLabels } from "@/lib/client-labels"

export const dynamic = "force-dynamic"

const FEED_KEY_SHA256 = "d14381f138435afd564e53ae2ebd580a7c6b7a9ab231ba03136467e603773265"

const PORTAL_URL = "https://clients.edwardsfamilylaw.com"

const ALLOWED_ORIGINS = new Set([
  "https://eflapps.tiiny.site",
  "http://localhost:3000",
  "http://localhost:8000",
])

function corsHeaders(origin: string | null): Record<string, string> {
  const allow = origin && ALLOWED_ORIGINS.has(origin) ? origin : "https://eflapps.tiiny.site"
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "X-Feed-Key",
    "Access-Control-Max-Age": "86400",
    "Cache-Control": "no-store",
    Vary: "Origin",
  }
}

function keyOk(request: NextRequest): boolean {
  const supplied = request.headers.get("x-feed-key") ?? ""
  if (!supplied) return false
  const expectedHex = process.env.TASKS_FEED_KEY_SHA256 || FEED_KEY_SHA256
  const suppliedHash = createHash("sha256").update(supplied).digest()
  let expected: Buffer
  try {
    expected = Buffer.from(expectedHex, "hex")
  } catch {
    return false
  }
  return suppliedHash.length === expected.length && timingSafeEqual(suppliedHash, expected)
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(request.headers.get("origin")) })
}

export async function GET(request: NextRequest) {
  const headers = corsHeaders(request.headers.get("origin"))
  if (!keyOk(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers })
  }

  try {
    const [pending, clients, labels] = await Promise.all([
      sql`SELECT id, client_id, title, description, due_date, stage, tag, created_at
          FROM client_tasks
          WHERE status = 'pending'
          ORDER BY due_date ASC NULLS LAST, created_at DESC`,
      getAllClients().catch(() => []),
      getClientLabels().catch(() => ({}) as Record<string, string>),
    ])

    const nameById = new Map<string, string>()
    for (const c of clients) {
      if (c.clientId) {
        const id = String(c.clientId)
        nameById.set(id, labels[id] || clientDisplayLabel(c.name) || c.name)
      }
    }

    const tasks = pending.rows.map((t) => {
      const clientId = String(t.client_id ?? "")
      const due = t.due_date ? new Date(t.due_date) : null
      const parts: string[] = []
      if (t.stage) parts.push(String(t.stage))
      if (t.tag) parts.push(String(t.tag))
      if (due && !isNaN(due.getTime())) {
        parts.push(`due ${due.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`)
      }
      if (t.description) parts.push(String(t.description))
      return {
        id: `pt-${t.id}`,
        kind: "client-task",
        matterName: nameById.get(clientId) || "Client",
        matterType: "Client Portal",
        title: String(t.title ?? "Task"),
        detail: parts.join(" · "),
        href: `${PORTAL_URL}/admin/tasks`,
        since: new Date(t.created_at).toISOString(),
      }
    })

    return NextResponse.json(
      {
        count: tasks.length,
        generatedAt: new Date().toISOString(),
        tasksUrl: `${PORTAL_URL}/admin/tasks`,
        tasks,
      },
      { headers },
    )
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500, headers })
  }
}
