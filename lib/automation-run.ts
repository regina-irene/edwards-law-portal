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
import { getPleadings } from "@/lib/pleadings"
import { getCorrespondence } from "@/lib/correspondence"
import { sendNewDocumentsEmail } from "@/lib/resend"
import {
  AUTO_SEND_LIMIT,
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

/** "Lastname | Firstname" is how the Clients board stores it. */
function firstNameOf(client: AirtableClient): string {
  return (String(client.name ?? "").split("|")[1] ?? "").trim()
}

/** What to call these documents in the client's email. */
function nounFor(rule: AutomationRule): string {
  return rule.board === "pleadings" ? "filing" : "letter"
}

async function documentsFor(rule: AutomationRule, baseId: string): Promise<QueuedDoc[] | null> {
  if (rule.board === "pleadings") {
    const rows = await getPleadings(baseId)
    if (rows === null) return null
    return rows.map((d) => ({ id: d.id, title: d.title, link: d.link, date: d.filedOn }))
  }
  const rows = await getCorrespondence(baseId)
  if (rows === null) return null
  return rows.map((d) => ({ id: d.id, title: d.title, link: d.link, date: d.sentOn }))
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

  for (const rule of enabled) {
    const s: RunSummary = { ran: true, seeded: 0, sent: 0, queued: 0, skipped: 0, errors: [] }

    for (const client of clients) {
      const clientId = String(client.clientId ?? "")
      if (!clientId || !client.clientBaseId) {
        s.skipped++
        continue
      }

      try {
        const docs = await documentsFor(rule, client.clientBaseId)
        // null means the board could not be read - a base without that table,
        // or Airtable having a bad minute. Do NOTHING. Treating an unreadable
        // board as an empty one would mark every real document as seen and the
        // client would never be told about any of them.
        if (docs === null) {
          s.skipped++
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
          await sendNewDocumentsEmail({
            to: client.email,
            firstName: firstNameOf(client),
            noun: nounFor(rule),
            documents: fresh,
          })
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
