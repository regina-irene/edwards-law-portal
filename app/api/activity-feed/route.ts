// app/api/activity-feed/route.ts
// ── Read-only Field Notes activity feed for the EFL Apps dashboard ───────────
// Returns the same running log the Field Notes hub shows (/admin/notes):
// hand-written field notes merged with live portal activity — messages, file
// uploads and views, form updates, completed tasks — newest first, across every
// case. GET only; nothing can be changed through this endpoint.
//
// PRIVILEGED CONTENT. Field notes are the firm's private case log and message
// previews quote clients directly. This route serves them to anyone holding the
// dashboard key, so the key is the only thing standing between this log and the
// open internet. Rotate it the way you would a password, and do not widen
// ALLOWED_ORIGINS beyond the firm's own pages.
//
// Auth and CORS mirror /api/tasks-feed exactly, including the shared key, so
// the dashboard authenticates once for both feeds.
import { NextRequest, NextResponse } from "next/server"
import { createHash, timingSafeEqual } from "crypto"
import { searchNotes } from "@/lib/notes"
import { fetchAllEvents, clientProseName, type TimelineEvent } from "@/lib/notes-timeline"
import { fetchAllClientsRaw, clientDisplayLabel } from "@/lib/airtable"
import { getClientLabels } from "@/lib/client-labels"

export const dynamic = "force-dynamic"

const FEED_KEY_SHA256 = "d14381f138435afd564e53ae2ebd580a7c6b7a9ab231ba03136467e603773265"

const PORTAL_URL = "https://clients.edwardsfamilylaw.com"

// How many rows the dashboard gets. It renders 60 and links out for the rest.
const MAX_ITEMS = 120

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

// The hub's six event kinds collapse into the four the dashboard draws.
function typeOf(kind: TimelineEvent["kind"]): "message" | "file" | "task" {
  if (kind === "chat" || kind === "message") return "message"
  if (kind === "upload" || kind === "view") return "file"
  return "task"
}

// Event hrefs are portal-relative; the dashboard lives on another domain.
function absolute(href: string | undefined): string | undefined {
  if (!href) return undefined
  return href.startsWith("/") ? `${PORTAL_URL}${href}` : href
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
    const [clients, labels, notes] = await Promise.all([
      fetchAllClientsRaw().catch(() => []),
      getClientLabels().catch(() => ({}) as Record<string, string>),
      searchNotes("", "", "", MAX_ITEMS).catch(() => []),
    ])

    const labelOf = (id: string) => {
      const raw = clients.find((c) => String(c.clientId) === id)?.name
      return labels[id] || (raw ? clientDisplayLabel(raw) : "") || id
    }
    const nameOf = (id: string) =>
      clientProseName(clients.find((c) => String(c.clientId) === id)?.name) || labels[id] || ""

    // Fail-soft, like the hub: a dead source must not blank the whole log.
    const events = await fetchAllEvents(nameOf, 60).catch(() => [] as TimelineEvent[])

    const noteItems = notes.map((n) => ({
      id: `note-${n.noteId}`,
      type: "note" as const,
      matterName: labelOf(n.clientId),
      actor: n.author_name ?? "",
      text: n.snippet,
      href: `${PORTAL_URL}/admin/notes/${n.clientId}`,
      at: new Date(n.created_at).toISOString(),
    }))

    const eventItems = events
      .filter((e) => e.clientId)
      .map((e) => ({
        id: e.id,
        type: typeOf(e.kind),
        matterName: labelOf(e.clientId!),
        actor: "",
        text: e.detail,
        href: absolute(e.href) ?? `${PORTAL_URL}/admin/notes/${e.clientId}`,
        at: new Date(e.at).toISOString(),
      }))

    const items = [...noteItems, ...eventItems]
      .filter((i) => !isNaN(Date.parse(i.at)))
      .sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : b.id.localeCompare(a.id)))
      .slice(0, MAX_ITEMS)

    return NextResponse.json(
      {
        count: items.length,
        generatedAt: new Date().toISOString(),
        activityUrl: `${PORTAL_URL}/admin/notes`,
        items,
      },
      { headers },
    )
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500, headers })
  }
}
