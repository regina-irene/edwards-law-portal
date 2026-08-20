// app/api/admin/case-status/assist/route.ts - the three helpers behind the
// admin Status board:
//   draft - Claude writes a plain-English status update TO the client. Returned
//           for review only; NOTHING is written to Airtable here.
//   ask - Claude answers a question about the whole board.
//   flag - which cases look stuck. Pure arithmetic, no model: a rule you can
//           read beats a guess you can't.
// Admin-only. Every path fails soft with a sentence, never a stack trace.
import { NextResponse } from "next/server"
import Anthropic from "@anthropic-ai/sdk"
import { requireAdmin } from "@/lib/admin"
import { buildStatusBoard, computeStuckFlags, plainStage } from "@/lib/case-status"

export const dynamic = "force-dynamic"

const MODEL = "claude-sonnet-5"

// House rules for anything the model writes for a client to read.
const CLIENT_VOICE = `You write for Edwards Family Law, a Georgia family-law firm, in the voice of the client's legal team.

Hard rules:
- Plain, warm, everyday English. A stressed non-lawyer must understand it on the first read.
- No legal jargon, no Latin, no abbreviations, no citations.
- Never give legal advice, never predict an outcome, never promise a date or a timeline.
- Never mention fees, payment status, the judge by name, or anything internal to the firm.
- Do not invent facts. Work only from what you are given.
- Anything labelled confidential internal notes is BACKGROUND ONLY. Never quote it, never
  restate it, never reuse its phrasing, and never mention that it exists. Write the update
  from scratch in your own plain words.
- Write it as text the client will read, addressed to them. No greeting, no sign-off, no subject line.`

interface AssistBody {
  mode?: unknown
  question?: unknown
  name?: unknown
  stages?: unknown
  statusText?: unknown
  caseTypes?: unknown
  county?: unknown
  daysSinceUpdate?: unknown
  context?: unknown
}

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : ""
}

function strList(v: unknown): string[] {
  return Array.isArray(v) ? v.map((s) => str(s)).filter(Boolean) : []
}

async function askClaude(system: string, prompt: string): Promise<string> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("Claude isn't configured on this environment.")
  }
  const client = new Anthropic()
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 1000,
    system,
    messages: [{ role: "user", content: prompt }],
  })
  const block = response.content.find((b) => b.type === "text")
  const text = block && block.type === "text" ? block.text.trim() : ""
  if (!text) throw new Error("Claude came back empty.")
  return text
}

export async function POST(req: Request) {
  const check = await requireAdmin()
  if (check.status !== "ok") return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = (await req.json().catch(() => null)) as AssistBody | null
  const mode = str(body?.mode)

  if (mode !== "draft" && mode !== "ask" && mode !== "flag") {
    return NextResponse.json({ error: "Unknown request." }, { status: 400 })
  }

  // ---- flag: deterministic, no model ------------------------------------
  if (mode === "flag") {
    try {
      const rows = await buildStatusBoard()
      return NextResponse.json({ flags: computeStuckFlags(rows) })
    } catch (e) {
      console.error("[case-status/assist] flag failed:", e)
      return NextResponse.json(
        { error: "Couldn't check which cases are stuck right now." },
        { status: 500 }
      )
    }
  }

  // ---- draft: one case in, a suggested status update out ----------------
  if (mode === "draft") {
    const stages = strList(body?.stages)
    const caseTypes = strList(body?.caseTypes)
    const county = str(body?.county).replace(/^\*/, "")
    const current = str(body?.statusText)
    const extra = str(body?.context)
    const rawDays: unknown = body ? body.daysSinceUpdate : undefined
    const days = typeof rawDays === "number" && Number.isFinite(rawDays) ? rawDays : null

    const facts = [
      `Case: ${str(body?.name) || "this client"}`,
      stages.length > 0
        ? `Where the case stands: ${stages.map((s) => plainStage(s)).join("; ")}`
        : "Where the case stands: not recorded",
      caseTypes.length > 0 ? `Type of matter: ${caseTypes.join(", ")}` : "",
      county ? `County: ${county}` : "",
      days !== null ? `Days since the last update to this case: ${days}` : "",
      current ? `The status the client currently sees:\n"""${current}"""` : "",
      extra
        ? `Confidential internal notes. Background only, never quote or restate:\n"""${extra}"""`
        : "",
    ].filter(Boolean)

    const prompt = `Write the next case-status update for this client's portal.

${facts.join("\n")}

Write 1 to 3 sentences: where things stand, and what happens next in general terms. If there is an existing status above, this should read as an update on it, not a repeat. Output only the update text.`

    try {
      const text = await askClaude(CLIENT_VOICE, prompt)
      return NextResponse.json({ text })
    } catch (e) {
      console.error("[case-status/assist] draft failed:", e)
      return NextResponse.json(
        { error: "Couldn't draft an update right now - write it yourself or try again." },
        { status: 502 }
      )
    }
  }

  // ---- ask: a question about the whole board ----------------------------
  const question = str(body?.question)
  if (!question) return NextResponse.json({ error: "Ask a question first." }, { status: 400 })
  if (question.length > 2000) {
    return NextResponse.json({ error: "That question is too long." }, { status: 400 })
  }

  try {
    const rows = await buildStatusBoard()
    if (rows.length === 0) {
      return NextResponse.json(
        { error: "The case board couldn't be loaded, so there's nothing to answer from." },
        { status: 502 }
      )
    }
    const flagged = new Map(computeStuckFlags(rows).map((f) => [f.recordId, f.reason]))

    // Only what an answer needs. No payment status, no judge, no email.
    const board = rows
      .map((r) => {
        const stage = r.stages.length > 0 ? r.stages.map((s) => plainStage(s)).join("; ") : "no stage recorded"
        const age = r.daysSinceUpdate === null ? "never updated" : `updated ${r.daysSinceUpdate} days ago`
        const flag = flagged.get(r.recordId)
        return `- ${r.name} | ${stage} | ${age}${r.county ? ` | ${r.county.replace(/^\*/, "")}` : ""}${flag ? ` | FLAGGED: ${flag}` : ""} | status shown to client: ${r.statusText || "(blank)"}`
      })
      .join("\n")

    const system = `You are helping a family-law firm's staff read their own case board. Answer only from the board below.

Rules:
- Be direct and specific. Name the cases you are talking about.
- If the board doesn't contain the answer, say so plainly instead of guessing.
- Counts and comparisons must come from the rows, not from memory.
- Keep it short - a few sentences or a short list.
- This is an internal answer for staff, not something a client will see.`

    const prompt = `Case board (${rows.length} cases):
${board}

Question: ${question}`

    const text = await askClaude(system, prompt)
    return NextResponse.json({ text })
  } catch (e) {
    console.error("[case-status/assist] ask failed:", e)
    return NextResponse.json(
      { error: "Couldn't answer that right now - try again in a moment." },
      { status: 502 }
    )
  }
}
