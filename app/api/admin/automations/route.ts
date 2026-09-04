// app/api/admin/automations/route.ts - the Automations page's back end.
// Admin only, like everything under /api/admin.
//
// GET    the rules, what is waiting for approval, and what has gone out
// PATCH  turn a rule on/off, or switch it between approve and automatic
// POST   send or dismiss a queued email, or run a scan now
import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin"
import { clientFirstName } from "@/lib/client-ids"
import { sendNewDocumentsEmail } from "@/lib/resend"
import { renderEmail, DEFAULT_SUBJECT, DEFAULT_BODY, PLACEHOLDERS } from "@/lib/automation-email"
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
    return NextResponse.json({
      rules,
      pending,
      history,
      // So the editor can show what is available and offer "back to default"
      // without the wording being duplicated in the browser code.
      defaults: { subject: DEFAULT_SUBJECT, body: DEFAULT_BODY },
      placeholders: PLACEHOLDERS,
    })
  } catch (e) {
    console.error("[admin/automations] list failed:", e)
    return NextResponse.json({ error: "Couldn't load the automations." }, { status: 500 })
  }
}

export async function PATCH(req: Request) {
  const { denied } = await gate()
  if (denied) return denied

  const body = (await req.json().catch(() => null)) as
    | { key?: unknown; enabled?: unknown; mode?: unknown; subject?: unknown; emailBody?: unknown }
    | null
  const key = typeof body?.key === "string" ? body.key : ""
  if (!ruleByKey(key)) return NextResponse.json({ error: "Unknown automation." }, { status: 400 })

  const patch: {
    enabled?: boolean
    mode?: AutomationMode
    subject?: string | null
    body?: string | null
  } = {}
  if (typeof body?.enabled === "boolean") patch.enabled = body.enabled
  if (body?.mode === "auto" || body?.mode === "approve") patch.mode = body.mode
  // null puts a field back to the shipped default; a string saves her wording.
  // Capped so a paste accident cannot fill the column with a novel.
  if (body?.subject === null) patch.subject = null
  else if (typeof body?.subject === "string") patch.subject = body.subject.slice(0, 300)
  if (body?.emailBody === null) patch.body = null
  else if (typeof body?.emailBody === "string") patch.body = body.emailBody.slice(0, 8000)

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

  if (action === "preview") {
    const key = typeof (body as { key?: unknown })?.key === "string" ? String((body as { key: string }).key) : ""
    const rule = (await listRules()).find((r) => r.key === key)
    if (!rule) return NextResponse.json({ error: "Unknown automation." }, { status: 400 })
    const raw = body as { subject?: unknown; emailBody?: unknown }
    // Previewed from what is on screen, not from what is saved, so she can see
    // an edit before committing to it.
    const mail = renderEmail(
      typeof raw.subject === "string" ? raw.subject : rule.subject,
      typeof raw.emailBody === "string" ? raw.emailBody : rule.body,
      {
        firstName: "Jane",
        clientName: "Sample | Jane",
        documents: [
          {
            title: "2026.09.02 Notice of Hearing",
            link: "https://drive.google.com/file/d/EXAMPLE/view",
            date: "2026-09-02",
          },
          {
            title: "2026.09.03 Letter to Opposing Counsel",
            link: "https://drive.google.com/file/d/EXAMPLE2/view",
            date: "2026-09-03",
          },
        ],
        portalUrl: process.env.AUTH_URL ?? "https://edwards-law-portal.vercel.app",
        noun: rule.noun,
      }
    )
    return NextResponse.json({ ok: true, preview: mail })
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
    const rule = (await listRules()).find((r) => r.key === item.ruleKey)
    try {
      const mail = renderEmail(rule?.subject ?? DEFAULT_SUBJECT, rule?.body ?? DEFAULT_BODY, {
        firstName: clientFirstName(item.clientName),
        clientName: item.clientName,
        documents: item.documents,
        portalUrl: process.env.AUTH_URL ?? "https://edwards-law-portal.vercel.app",
        noun: rule?.noun ?? "filing",
      })
      await sendNewDocumentsEmail({ to: item.clientEmail, ...mail })
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
