// lib/automation-run.ts - the scan itself (2026-09-04).
//
// Runs hourly from /api/cron/automations, and on demand from the "Check now"
// button. Reads each active client's Pleadings and Correspondence boards,
// works out what is new since last time, and either emails the client or puts
// it in the approval queue depending on how the rule is set.
//
// Read lib/automations first: the three safety rules live there and this file
// is the thing that has to honour them.
import { getAllClients, type AirtableClient } from "@/lib/airtable"
import { clientFirstName } from "@/lib/client-ids"
import { getPleadings } from "@/lib/pleadings"
import { getCorrespondence } from "@/lib/correspondence"
import { getDiscovery } from "@/lib/discovery"
import { getCaseEvents } from "@/lib/calendar"
import { listAllCaseStatuses } from "@/lib/case-status"
import { sql } from "@/lib/db"
import { sendNewDocumentsEmail } from "@/lib/resend"
import { renderEmail } from "@/lib/automation-email"
import {
  AUTO_SEND_LIMIT,
  DORMANT_DAYS,
  listRules,
  hasSeenClient,
  seenRecordIds,
  markSeen,
  enqueue,
  ensureAutomationTables,
  type AutomationRule,
  type QueuedDoc,
} from "@/lib/automations"

export interface RunSummary {
  ran: boolean
  reason?: string
  /** Clients whose board this rule looked at for the first time (nothing sent). */
  seeded: number
  sent: number
  queued: number
  skipped: number
  errors: string[]
}

/** "Gichana, Culix" for a subject line the firm can scan. */
function clientLabelOf(client: AirtableClient): string {
  const raw = String(client.name ?? "").trim()
  const parts = raw.split(/[|,]/).map((p) => p.trim()).filter(Boolean)
  return parts.length > 1 ? `${parts[0]}, ${parts[1]}` : raw
}

/** Tolerant of "Lastname | Firstname" and "Lastname, Firstname" alike. */
function firstNameOf(client: AirtableClient): string {
  return clientFirstName(String(client.name ?? ""))
}

/** Where the client signs in. Same fallback the other emails use. */
function PORTAL_URL(): string {
  return process.env.AUTH_URL ?? "https://edwards-law-portal.vercel.app"
}

/** What to call these in the client's email. */
function nounFor(rule: AutomationRule): string {
  return rule.noun
}

/** The board name, for an error message that tells her where to look. */
function boardLabel(rule: AutomationRule): string {
  if (rule.kind !== "documents") return rule.label
  if (rule.board === "pleadings") return "Pleadings board"
  if (rule.board === "discovery") return "Discovery board"
  return "Correspondence board"
}

/**
 * A short, stable id for a piece of text.
 *
 * Used where there is no Airtable record id to key on - a case status is just
 * words in a cell. Hashing the words means the same status is recognised as
 * "already told them", and changing a comma counts as a change, which is the
 * behaviour you want: if she edited it, she meant to say something.
 *
 * Not cryptographic and does not need to be. A collision would at worst skip
 * one notification.
 */
function digest(s: string): string {
  let h = 5381
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0
  return Math.abs(h).toString(36)
}

async function documentsFor(rule: AutomationRule, baseId: string): Promise<QueuedDoc[] | null> {
  if (rule.board === "pleadings") {
    const rows = await getPleadings(baseId)
    if (rows === null) return null
    return rows.map((d) => ({ id: d.id, title: d.title, link: d.link, date: d.filedOn }))
  }
  if (rule.board === "discovery") {
    // getDiscovery already returns ONLY rows ticked "Avail. to Client", so
    // nothing she has not released can reach this function at all.
    const rows = await getDiscovery(baseId)
    if (rows === null) return null
    return rows.map((d) => ({ id: d.id, title: d.title, link: d.link, date: d.date }))
  }
  const rows = await getCorrespondence(baseId)
  if (rows === null) return null
  return rows.map((d) => ({ id: d.id, title: d.title, link: d.link, date: d.sentOn }))
}

/**
 * The client-facing case status, as one item.
 *
 * Reads "Case Status - For Client" and never the internal column - the whole
 * point of splitting those two was that the firm's own notes are not for the
 * client, and an automatic email is the last place that should get confused.
 */
function statusFor(clientId: string, statuses: Map<string, string>): QueuedDoc[] | null {
  const text = (statuses.get(clientId) ?? "").trim()
  if (!text) return []
  return [{ id: `status:${digest(text)}`, title: text, link: "", date: null }]
}

/**
 * Court dates worth a reminder: a week out, and again the day before.
 *
 * Emitted as soon as the date falls inside each window rather than on an exact
 * day, because an hourly job that looks for "exactly 7 days away" misses any
 * hearing whose hour it happens not to run on. The seen-list is what stops the
 * same reminder going out every hour once it is inside the window.
 */
function hearingsFor(events: { id: string; title: string; start: string; location: string; eventLink: string; status: string }[]): QueuedDoc[] {
  const now = Date.now()
  const DAY = 24 * 60 * 60 * 1000
  const out: QueuedDoc[] = []

  for (const e of events) {
    if (e.status && e.status.toLowerCase() === "cancelled") continue
    const start = new Date(e.start).getTime()
    if (!Number.isFinite(start) || start < now) continue
    const daysOut = (start - now) / DAY

    const when = new Date(e.start).toLocaleString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZone: "America/New_York",
    })
    const title = `${e.title} - ${when}${e.location ? ` - ${e.location}` : ""}`

    if (daysOut <= 1) out.push({ id: `${e.id}:day`, title, link: e.eventLink, date: null })
    else if (daysOut <= 7) out.push({ id: `${e.id}:week`, title, link: e.eventLink, date: null })
  }
  return out
}

/**
 * When each client last signed in. One query for everybody rather than one per
 * client, since the scan already reads two Airtable boards per client and does
 * not need a database round trip per client on top.
 */
async function lastSignIns(): Promise<Map<string, number>> {
  const out = new Map<string, number>()
  try {
    const r = await sql`
      SELECT LOWER(email) AS email, MAX(created_at) AS last
      FROM auth_activity WHERE kind = 'sign_in' GROUP BY LOWER(email)
    `
    for (const row of r.rows) {
      const t = new Date(String(row.last)).getTime()
      if (Number.isFinite(t)) out.set(String(row.email), t)
    }
  } catch {
    // No table, or the database having a bad minute. An empty map makes every
    // client look like they have never signed in, which would nudge the whole
    // roster at once - so the caller treats an empty map as "do not run".
  }
  return out
}

/** Everyone on the Staff access list, for the rules that copy the firm in. */
async function firmRecipients(): Promise<string[]> {
  try {
    const r = await sql`SELECT email FROM admin_users`
    return r.rows.map((row) => String(row.email)).filter(Boolean)
  } catch {
    return []
  }
}

/**
 * A client who has not opened the portal in DORMANT_DAYS.
 *
 * The id carries the month, so a client who stays away gets at most one nudge
 * a month rather than one an hour for ever.
 */
function dormantFor(email: string, signIns: Map<string, number>): QueuedDoc[] {
  const last = signIns.get(email.trim().toLowerCase())
  const DAY = 24 * 60 * 60 * 1000
  // Never signed in at all is handled by the invite email, not by a nudge that
  // says "it has been a while since you last visited".
  if (!last) return []
  const days = Math.floor((Date.now() - last) / DAY)
  if (days < DORMANT_DAYS) return []
  const month = new Date().toISOString().slice(0, 7)
  return [
    {
      id: `dormant:${month}`,
      title: `It has been ${days} days since you last opened your portal.`,
      link: "",
      date: null,
    },
  ]
}

/**
 * Run every enabled rule over every active client.
 *
 * One client failing never stops the run: a client whose Airtable base is
 * misnamed should not stop the client after them from hearing about their
 * hearing notice. Errors are collected and reported.
 */
export async function runAutomations(): Promise<Record<string, RunSummary>> {
  await ensureAutomationTables()
  const rules = await listRules()
  const out: Record<string, RunSummary> = {}

  const enabled = rules.filter((r) => r.enabled)
  if (enabled.length === 0) {
    for (const r of rules) {
      out[r.key] = { ran: false, reason: "Turned off", seeded: 0, sent: 0, queued: 0, skipped: 0, errors: [] }
    }
    return out
  }

  // Archived clients are closed files. Nothing here writes to a former client.
  const clients = (await getAllClients()).filter((c) => !c.archived)

  // Fetched once for the whole run rather than per client per rule.
  const needsStatus = enabled.some((r) => r.kind === "status")
  const needsSignIns = enabled.some((r) => r.kind === "dormant")

  const statuses = new Map<string, string>()
  if (needsStatus) {
    try {
      for (const row of await listAllCaseStatuses()) {
        statuses.set(String(row.recordId), row.statusText ?? "")
      }
    } catch {
      // Left empty, and the status rule below refuses to run on an empty map
      // rather than concluding every client's status is blank.
    }
  }
  const signIns = needsSignIns ? await lastSignIns() : new Map<string, number>()

  for (const rule of enabled) {
    // A reader that came back with nothing at all is a failure, not an answer.
    // Running on it would mark every client as accounted for and mean nobody is
    // ever told anything again - the same trap as an unreadable Airtable board.
    if (rule.kind === "status" && statuses.size === 0) {
      out[rule.key] = {
        ran: false,
        reason: "Couldn't read the status board, so nothing was checked.",
        seeded: 0, sent: 0, queued: 0, skipped: 0,
        errors: ["Couldn't read the case status board just now. Nothing was sent."],
      }
      continue
    }
    if (rule.kind === "dormant" && signIns.size === 0) {
      out[rule.key] = {
        ran: false,
        reason: "Couldn't read the sign-in history, so nothing was checked.",
        seeded: 0, sent: 0, queued: 0, skipped: 0,
        errors: ["Couldn't read sign-in history just now. Nothing was sent."],
      }
      continue
    }

    const s: RunSummary = { ran: true, seeded: 0, sent: 0, queued: 0, skipped: 0, errors: [] }

    for (const client of clients) {
      const clientId = String(client.clientId ?? "")
      const who = client.name || clientId || "A client"
      // Only the board-reading rules need an Airtable base of their own. A
      // status or a sign-in date is held elsewhere, so demanding a base id for
      // those would skip clients for no reason.
      const needsBase = rule.kind === "documents"
      if (!clientId || (needsBase && !client.clientBaseId)) {
        // Named, because this is fixable: somebody has to put the base id on
        // the Clients board. A bare count of "skipped" hides that for ever.
        s.skipped++
        s.errors.push(`${who}: no Airtable base id on the Clients board.`)
        continue
      }

      try {
        let docs: QueuedDoc[] | null
        if (rule.kind === "documents") {
          docs = await documentsFor(rule, client.clientBaseId)
        } else if (rule.kind === "status") {
          docs = statusFor(clientId, statuses)
        } else if (rule.kind === "hearing") {
          const events = await getCaseEvents(clientId).catch(() => null)
          docs = events === null ? null : hearingsFor(events)
        } else {
          docs = client.email ? dormantFor(client.email, signIns) : []
        }
        // null means the board could not be read - a base without that table,
        // or Airtable having a bad minute. Do NOTHING. Treating an unreadable
        // board as an empty one would mark every real document as seen and the
        // client would never be told about any of them.
        //
        // Named for the same reason. A malformed base id on ONE client is what
        // caused this exact silence in September 2026, and the only symptom was
        // the skipped counter going up by one.
        if (docs === null) {
          s.skipped++
          s.errors.push(
            `${who}: couldn't read their ${boardLabel(rule)}. Check the Client Base ID on the Clients board, and that the base has a table with that name.`
          )
          continue
        }

        const first = !(await hasSeenClient(rule.key, clientId))
        if (first) {
          // SAFETY RULE 2. Everything already there is history, not news.
          await markSeen(rule.key, clientId, docs.map((d) => d.id))
          s.seeded++
          continue
        }

        const seen = await seenRecordIds(rule.key, clientId)
        const fresh = docs.filter((d) => d.id && !seen.has(d.id))
        if (fresh.length === 0) continue

        // Marked seen BEFORE sending, on purpose. See markSeen.
        await markSeen(rule.key, clientId, fresh.map((d) => d.id))

        // A client with no email, or who has asked not to be emailed, still
        // gets their documents on the portal; they just do not get told.
        if (!client.email || client.noMessageEmails) {
          s.skipped++
          continue
        }

        // SAFETY RULE 3. A big batch is a re-sync, not a filing day.
        const tooMany = fresh.length > AUTO_SEND_LIMIT
        const shouldSendNow = rule.mode === "auto" && !tooMany

        if (!shouldSendNow) {
          await enqueue({
            ruleKey: rule.key,
            clientId,
            clientName: client.name ?? "",
            clientEmail: client.email,
            documents: fresh,
            status: "pending",
          })
          s.queued++
          continue
        }

        try {
          const mail = renderEmail(rule.subject, rule.body, {
            firstName: firstNameOf(client),
            clientName: client.name ?? "",
            documents: fresh,
            portalUrl: PORTAL_URL(),
            noun: nounFor(rule),
          })
          await sendNewDocumentsEmail({ to: client.email, ...mail })

          // Court dates copy the firm in. Sent separately rather than as a cc,
          // so the client never sees the firm's addresses, and wrapped in its
          // own try: the client has been told, and a failure to copy the office
          // must not mark the whole thing failed and invite a re-send to them.
          if (rule.alsoFirm) {
            try {
              const to = await firmRecipients()
              for (const addr of to) {
                await sendNewDocumentsEmail({
                  to: addr,
                  subject: `[${clientLabelOf(client)}] ${mail.subject}`,
                  text: mail.text,
                  html: mail.html,
                })
              }
            } catch (e) {
              console.error("[automations] firm copy failed:", e instanceof Error ? e.message : e)
            }
          }
          await enqueue({
            ruleKey: rule.key,
            clientId,
            clientName: client.name ?? "",
            clientEmail: client.email,
            documents: fresh,
            status: "sent",
          })
          s.sent++
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e)
          await enqueue({
            ruleKey: rule.key,
            clientId,
            clientName: client.name ?? "",
            clientEmail: client.email,
            documents: fresh,
            status: "failed",
            error: msg,
          })
          s.errors.push(`${client.name || clientId}: ${msg}`)
        }
      } catch (e) {
        s.errors.push(`${client.name || clientId}: ${e instanceof Error ? e.message : String(e)}`)
      }
    }

    out[rule.key] = s
  }

  for (const r of rules) {
    if (!out[r.key]) {
      out[r.key] = { ran: false, reason: "Turned off", seeded: 0, sent: 0, queued: 0, skipped: 0, errors: [] }
    }
  }
  return out
}

/**
 * Draw the line at the moment a rule is switched on (2026-09-04).
 *
 * Every document currently on every active client's board is recorded as
 * history, so "new" means "arrived after Regina turned this on" rather than
 * "arrived after the next scheduled check". Two reasons that matters:
 *
 *   - It is what someone switching a rule on actually expects. Otherwise there
 *     is a silent gap between switching on and the first hourly check, and
 *     anything that lands in that gap is swallowed as history.
 *   - It makes the thing testable. Switch on, add a document, press Check now,
 *     get the email. Before this, the first Check now was always the silent
 *     one, which looks exactly like a broken feature.
 *
 * Sends nothing. Ever. That is the whole point of it.
 */
export async function seedRule(ruleKey: string): Promise<{ seeded: number; skipped: number }> {
  await ensureAutomationTables()
  const rule = (await listRules()).find((r) => r.key === ruleKey)
  if (!rule) return { seeded: 0, skipped: 0 }

  const clients = (await getAllClients()).filter((c) => !c.archived)
  let seeded = 0
  let skipped = 0

  // Same readers the scan uses, so every kind of rule gets the same silent
  // first look - not just the ones that read a board.
  const statuses = new Map<string, string>()
  if (rule.kind === "status") {
    try {
      for (const row of await listAllCaseStatuses()) {
        statuses.set(String(row.recordId), row.statusText ?? "")
      }
    } catch {
      return { seeded: 0, skipped: clients.length }
    }
  }
  const signIns = rule.kind === "dormant" ? await lastSignIns() : new Map<string, number>()

  for (const client of clients) {
    const clientId = String(client.clientId ?? "")
    if (!clientId || (rule.kind === "documents" && !client.clientBaseId)) {
      skipped++
      continue
    }
    try {
      let docs: QueuedDoc[] | null
      if (rule.kind === "documents") {
        docs = await documentsFor(rule, client.clientBaseId)
      } else if (rule.kind === "status") {
        docs = statusFor(clientId, statuses)
      } else if (rule.kind === "hearing") {
        const events = await getCaseEvents(clientId).catch(() => null)
        docs = events === null ? null : hearingsFor(events)
      } else {
        docs = client.email ? dormantFor(client.email, signIns) : []
      }
      // An unreadable board is left unseeded on purpose, so the next run treats
      // it as a first look rather than pretending the client has no documents.
      if (docs === null) {
        skipped++
        continue
      }
      await markSeen(rule.key, clientId, docs.map((d) => d.id))
      seeded++
    } catch {
      skipped++
    }
  }
  return { seeded, skipped }
}
