// app/api/admin/automations/route.ts - the Automations page's back end.
// Admin only, like everything under /api/admin.
//
// GET    the rules, what is waiting for approval, and what has gone out
// PATCH  turn a rule on/off, or switch it between approve and automatic
// POST   send or dismiss a queued email, or run a scan now
import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin"
import { sendNewDocumentsEmail } from "@/lib/resend"
import { runAutomations, seedRule } from "@/lib/automation-run"
import {
  listRules,
  setRule,
  listQueue,
  getQueueItem,
  decideQueueItem,
  ruleByKey,
  type AutomationMode,
} from "@/lib/automations"

export const dynamic = "force-dynamic"
export const maxDuration = 60

async function gate() {
  const check = await requireAdmin()
  if (check.status !== "ok") {
    return { denied: NextResponse.json({ error: "Unauthorized" }, { status: 401 }), email: "" }
  }
  return { denied: null, email: check.email }
}

export async function GET() {
  const { denied } = await gate()
  if (denied) return denied

  try {
    const [rules, pending, history] = await Promise.all([
      listRules(),
      listQueue("pending"),
      listQueue("history", 25),
    ])
    return NextResponse.json({ rules, pending, history })
  } catch (e) {
    console.error("[admin/automations] list failed:", e)
    return NextResponse.json({ error: "Couldn't load the automations." }, { status: 500 })
  }
}

export async function PATCH(req: Request) {
  const { denied } = await gate()
  if (denied) return denied

  const body = (await req.json().catch(() => null)) as
    | { key?: unknown; enabled?: unknown; mode?: unknown }
    | null
  const key = typeof body?.key === "string" ? body.key : ""
  if (!ruleByKey(key)) return NextResponse.json({ error: "Unknown automation." }, { status: 400 })

  const patch: { enabled?: boolean; mode?: AutomationMode } = {}
  if (typeof body?.enabled === "boolean") patch.enabled = body.enabled
  if (body?.mode === "auto" || body?.mode === "approve") patch.mode = body.mode

  try {
    // Switching a rule ON draws the line here and now: everything already on
    // the boards becomes history, so the first thing this ever emails about is
    // something that arrived after she turned it on. Done before setRule, so a
    // rule is never briefly on with nothing marked as seen - that window would
    // let the hourly check fire and email a client their whole file.
    const before = (await listRules()).find((r) => r.key === key)
    if (patch.enabled === true && before && !before.enabled) {
      await seedRule(key)
    }
    await setRule(key, patch)
    return NextResponse.json({ ok: true, rules: await listRules() })
  } catch (e) {
    console.error("[admin/automations] save failed:", e)
    return NextResponse.json({ error: "Couldn't save that." }, { status: 500 })
  }
}

export async function POST(req: Request) {
  const { denied, email } = await gate()
  if (denied) return denied

  const body = (await req.json().catch(() => null)) as
    | { action?: unknown; id?: unknown }
    | null
  const action = typeof body?.action === "string" ? body.action : ""

  if (action === "run") {
    try {
      const results = await runAutomations()
      return NextResponse.json({ ok: true, results })
    } catch (e) {
      console.error("[admin/automations] run failed:", e)
      return NextResponse.json({ error: "The check couldn't finish." }, { status: 500 })
    }
  }

  const id = Number(body?.id)
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 })
  }

  const item = await getQueueItem(id).catch(() => null)
  if (!item) return NextResponse.json({ error: "That item is gone." }, { status: 404 })
  // Re-sending something already decided would email the client twice.
  if (item.status !== "pending") {
    return NextResponse.json({ error: "That one has already been dealt with." }, { status: 409 })
  }

  if (action === "dismiss") {
    await decideQueueItem(id, "dismissed", email)
    return NextResponse.json({ ok: true })
  }

  if (action === "send") {
    const rule = ruleByKey(item.ruleKey)
    try {
      await sendNewDocumentsEmail({
        to: item.clientEmail,
        firstName: (item.clientName.split("|")[1] ?? "").trim(),
        noun: rule?.board === "correspondence" ? "letter" : "filing",
        documents: item.documents,
      })
      await decideQueueItem(id, "sent", email)
      return NextResponse.json({ ok: true })
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      // Left as failed rather than pending, so it cannot be half-sent twice.
      await decideQueueItem(id, "failed", email, msg)
      return NextResponse.json({ error: `That didn't send: ${msg}` }, { status: 500 })
    }
  }

  return NextResponse.json({ error: "Bad request" }, { status: 400 })
}
