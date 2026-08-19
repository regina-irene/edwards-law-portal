// app/api/admin/status-fields/route.ts - reads and saves which Status-board
// fields clients see. One route for both scopes: no clientId in the body means
// the firm-wide setting, a clientId means that client's override.
//
// Admin-only. Everything the Status board holds is internal by default (see
// lib/status-fields.ts), so this route only ever records a decision somebody
// made on the admin screen - it never widens anything on its own.
import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin"
import {
  DEFAULT_VISIBLE,
  configurableFieldNames,
  getClientFieldPrefs,
  getGlobalFieldPrefs,
  getStatusFieldNames,
  refreshStatusFieldNames,
  saveClientFieldPrefs,
  saveGlobalFieldPrefs,
} from "@/lib/status-fields"

export const dynamic = "force-dynamic"

// Guard rails on what may be written into app_settings. The board has a few
// dozen fields; anything wildly outside that is a bad request, not a setting.
const MAX_FIELDS = 300
const MAX_NAME_LENGTH = 200

export async function GET(req: Request): Promise<NextResponse> {
  const check = await requireAdmin()
  if (check.status !== "ok") return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const url = new URL(req.url)
  const clientId = (url.searchParams.get("clientId") ?? "").trim()
  const refresh = url.searchParams.get("refresh") === "1"

  try {
    const discovered = refresh ? await refreshStatusFieldNames() : await getStatusFieldNames()
    const [global, client] = await Promise.all([
      getGlobalFieldPrefs(),
      clientId ? getClientFieldPrefs(clientId) : Promise.resolve(null),
    ])
    return NextResponse.json({
      fields: configurableFieldNames(discovered),
      // Empty means the board couldn't be read - the screen says so rather
      // than pretending the firm has no fields.
      discovered: discovered.length,
      defaults: DEFAULT_VISIBLE,
      global,
      client,
    })
  } catch (e) {
    console.error("[status-fields] load failed:", e)
    return NextResponse.json({ error: "Couldn't read the Case Status board." }, { status: 500 })
  }
}

interface PutBody {
  clientId?: unknown
  prefs?: unknown
}

export async function PUT(req: Request): Promise<NextResponse> {
  const check = await requireAdmin()
  if (check.status !== "ok") return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = (await req.json().catch(() => null)) as PutBody | null
  const rawPrefs: unknown = body ? body.prefs : undefined
  if (!rawPrefs || typeof rawPrefs !== "object" || Array.isArray(rawPrefs)) {
    return NextResponse.json({ error: "A list of fields is required." }, { status: 400 })
  }

  const entries = Object.entries(rawPrefs as Record<string, unknown>)
  if (entries.length > MAX_FIELDS) {
    return NextResponse.json({ error: "Too many fields to save." }, { status: 400 })
  }

  const prefs: Record<string, boolean> = {}
  for (const [name, value] of entries) {
    const key = name.trim()
    if (!key || key.length > MAX_NAME_LENGTH) continue
    if (typeof value !== "boolean") {
      return NextResponse.json({ error: "Each field must be on or off." }, { status: 400 })
    }
    prefs[key] = value
  }

  const rawClientId = body && typeof body.clientId === "string" ? body.clientId.trim() : ""

  try {
    if (rawClientId) {
      const recordId = rawClientId.split(",")[0].trim()
      if (!recordId.startsWith("rec")) {
        return NextResponse.json({ error: "A valid client record id is required." }, { status: 400 })
      }
      await saveClientFieldPrefs(recordId, prefs)
    } else {
      await saveGlobalFieldPrefs(prefs)
    }
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error("[status-fields] save failed:", e)
    return NextResponse.json({ error: "That didn't save - nothing was changed." }, { status: 500 })
  }
}
