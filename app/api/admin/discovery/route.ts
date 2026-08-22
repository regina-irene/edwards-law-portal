// app/api/admin/discovery/route.ts - save one row on a client's Discovery
// table (2026-08-20).
//
// Every column here is the firm's own, so unlike the Pleadings and
// Correspondence board there is no Drive sync to work around and everything can
// be written.
//
// "available" is the one with teeth: it is the "Avail. to Client" checkbox, and
// lib/discovery serves the client only rows where it is ticked. Ticking it puts
// a document in front of a client; unticking it takes it away.
import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin"
import { getAllClients } from "@/lib/airtable"
import {
  updateDiscoveryRecord,
  type DiscoveryPatch,
  type DiscoveryField,
} from "@/lib/discovery-board"

export const dynamic = "force-dynamic"

/**
 * Which column name each key is allowed to address, PER KEY.
 *
 * A single flat list of allowed names is not enough, and getting that wrong
 * would have been a real hole: a request could send fieldNames.name = "URL"
 * alongside name: "javascript:...", and the value would land in the URL column
 * without ever passing the http(s) check below, then render as a link on the
 * client's own Discovery page. Binding each key to its own names closes that.
 */
const ALLOWED_FIELD_NAMES: Record<DiscoveryField, string[]> = {
  name: ["Name"],
  date: ["Date"],
  direction: ["Incoming or Outgoing"],
  tags: ["Tags"],
  notes: ["Notes", "Note"],
  url: ["URL", "Url", "Link"],
  available: ["Avail. to Client", "Avail to Client", "Available to Client"],
}

const FIELD_KEYS: DiscoveryField[] = ["name", "date", "direction", "tags", "notes", "url", "available"]

export async function PATCH(req: Request) {
  const check = await requireAdmin()
  if (check.status !== "ok") return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null

  const baseId = typeof body?.baseId === "string" ? body.baseId.trim() : ""
  const recordId = typeof body?.recordId === "string" ? body.recordId.trim() : ""
  if (!/^app[A-Za-z0-9]{10,}$/.test(baseId)) {
    return NextResponse.json({ error: "A valid client base is required." }, { status: 400 })
  }
  if (!/^rec[A-Za-z0-9]{10,}$/.test(recordId)) {
    return NextResponse.json({ error: "A valid document record is required." }, { status: 400 })
  }
  // Shape alone is not enough: the shared API key can reach bases that have
  // nothing to do with this portal, and a mistyped id should fail rather than
  // write somewhere unrelated. Fails closed if the roster cannot be read.
  const knownBase = await getAllClients()
    .then((cs) => cs.some((c) => String(c.clientBaseId) === baseId))
    .catch(() => false)
  if (!knownBase) {
    return NextResponse.json({ error: "Unknown client base." }, { status: 400 })
  }

  // The column names came from the row when it was read, so a base with its own
  // spelling is written back the same way. Constrained to the known names so a
  // tampered request cannot address some other column in a live base.
  const rawNames = body?.fieldNames
  if (!rawNames || typeof rawNames !== "object") {
    return NextResponse.json({ error: "Unrecognised columns." }, { status: 400 })
  }
  const fieldNames = {} as Record<DiscoveryField, string>
  for (const k of FIELD_KEYS) {
    const v = (rawNames as Record<string, unknown>)[k]
    if (typeof v !== "string" || !ALLOWED_FIELD_NAMES[k].includes(v)) {
      return NextResponse.json({ error: "Unrecognised columns." }, { status: 400 })
    }
    fieldNames[k] = v
  }

  const patch: DiscoveryPatch = {}
  if (body.name !== undefined) {
    if (typeof body.name !== "string") {
      return NextResponse.json({ error: "The name must be text." }, { status: 400 })
    }
    patch.name = body.name.trim()
  }
  if (body.date !== undefined) {
    if (body.date !== null && typeof body.date !== "string") {
      return NextResponse.json({ error: "The date must be text." }, { status: 400 })
    }
    const d = typeof body.date === "string" ? body.date.trim() : ""
    // Airtable wants an ISO date. An empty box clears the field rather than
    // writing a value it would reject.
    if (d && !/^\d{4}-\d{2}-\d{2}$/.test(d)) {
      return NextResponse.json({ error: "Use a date like 2026-08-20." }, { status: 400 })
    }
    patch.date = d || null
  }
  if (body.direction !== undefined) {
    if (typeof body.direction !== "string") {
      return NextResponse.json({ error: "That field must be text." }, { status: 400 })
    }
    // NOT trimmed: select options must match the board character for character.
    patch.direction = body.direction
  }
  if (body.tags !== undefined) {
    if (!Array.isArray(body.tags) || body.tags.some((t) => typeof t !== "string")) {
      return NextResponse.json({ error: "Tags must be a list." }, { status: 400 })
    }
    patch.tags = Array.from(new Set(body.tags as string[]))
  }
  if (body.notes !== undefined) {
    if (typeof body.notes !== "string") {
      return NextResponse.json({ error: "Notes must be text." }, { status: 400 })
    }
    patch.notes = body.notes.trim()
  }
  if (body.url !== undefined) {
    if (typeof body.url !== "string") {
      return NextResponse.json({ error: "The link must be text." }, { status: 400 })
    }
    const u = body.url.trim()
    // A link that isn't http(s) would render as a dead or, worse, a javascript:
    // target on the client's own page.
    if (u && !/^https?:\/\//i.test(u)) {
      return NextResponse.json({ error: "Links must start with http:// or https://" }, { status: 400 })
    }
    patch.url = u
  }
  if (body.available !== undefined) {
    if (typeof body.available !== "boolean") {
      return NextResponse.json({ error: "That setting must be on or off." }, { status: 400 })
    }
    patch.available = body.available
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Nothing to save." }, { status: 400 })
  }

  try {
    await updateDiscoveryRecord(baseId, recordId, patch, fieldNames)
    return NextResponse.json({ ok: true, recordId, ...patch })
  } catch (e) {
    console.error("[discovery] save failed:", e)
    return NextResponse.json(
      { error: "Airtable wouldn't accept that save - nothing was changed." },
      { status: 502 }
    )
  }
}
