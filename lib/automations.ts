// lib/automations.ts - rules that watch a client's boards and tell the client
// when something new lands (2026-09-04).
//
// WHAT THIS IS
// A pleading syncs from Drive into the client's Airtable Pleadings board. The
// client has no way of knowing that until they happen to open the portal. This
// watches those boards on a schedule and emails the client when something new
// appears.
//
// THE THREE SAFETY RULES, because this is the only part of the portal that
// sends mail to a client with nobody in the loop:
//
//   1. OFF UNTIL SWITCHED ON. Every rule starts disabled. Deploying this
//      sends nothing to anybody.
//
//   2. THE FIRST LOOK AT A BOARD IS ALWAYS SILENT. The first time a rule ever
//      scans a client, every document already there is recorded as "seen" and
//      no email is sent. Without this, turning the rule on would email a client
//      their entire filing history - hundreds of documents from a case that
//      closed years ago. This is the single most important line of code here.
//
//   3. A BIG BATCH ALWAYS WAITS FOR A HUMAN. If a scan finds more than
//      AUTO_SEND_LIMIT new documents at once, that is almost never twelve real
//      filings; it is Drive re-syncing a folder. Those go to the approval
//      queue even when the rule is set to send automatically.
//
// Tables are created on first use, the same reason as lib/ensure-columns: there
// must never be a command for Regina to run.
import { sql } from "@/lib/db"
import { DEFAULTS } from "@/lib/automation-email"

/** More new documents than this in one scan is a re-sync, not a filing day. */
export const AUTO_SEND_LIMIT = 8

export type AutomationMode = "approve" | "auto"

/**
 * What a rule watches. Each kind has its own reader in lib/automation-run and
 * its own default wording in lib/automation-email, but from there on they all
 * share the same machinery: the same seen-tracking, the same approval queue,
 * the same editable email, the same three safety rules.
 */
export type AutomationKind = "documents" | "status" | "hearing" | "dormant"

export interface AutomationRuleDef {
  key: string
  label: string
  /** What the rule watches, in plain words, shown on the page. */
  description: string
  kind: AutomationKind
  /** Which board it reads. Only for kind "documents". */
  board?: "pleadings" | "correspondence" | "discovery"
  /** What to call one of these in the email: "filing", "letter", "update". */
  noun: string
  /**
   * Send the firm a copy as well as the client. Only court dates: a hearing
   * nobody at the firm has noticed is a different kind of problem from a
   * document nobody has noticed. (Regina, 2026-09-04)
   */
  alsoFirm?: boolean
}

/**
 * The rules that exist. Adding one here is enough for it to appear on the
 * Automations page; the scanner reads `board` to know what to fetch.
 */
export const RULES: AutomationRuleDef[] = [
  {
    key: "new-pleading",
    label: "New filing on the Pleadings board",
    description:
      "When a document appears on a client's Pleadings board, email that client with the document and a link to their portal.",
    kind: "documents",
    board: "pleadings",
    noun: "filing",
  },
  {
    key: "new-correspondence",
    label: "New letter on the Correspondence board",
    description:
      "When a document appears on a client's Correspondence board, email that client with the document and a link to their portal.",
    kind: "documents",
    board: "correspondence",
    noun: "letter",
  },
  {
    key: "new-discovery",
    label: "New discovery marked available to the client",
    description:
      "When a Discovery row is ticked Avail. to Client, email that client. Rows that are not ticked are never read, so nothing you have not released can go out.",
    kind: "documents",
    board: "discovery",
    noun: "discovery item",
  },
  {
    key: "status-changed",
    label: "Case status changed",
    description:
      "When you change Case Status - For Client, email that client the new wording. Your internal Case Status - Dashboard column is never read by this.",
    kind: "status",
    noun: "update",
  },
  {
    key: "hearing-soon",
    label: "Court date coming up",
    description:
      "Email the client a week before a court date on their calendar, and again the day before, with the date, time and location. The firm gets a copy of each.",
    kind: "hearing",
    noun: "court date",
    alsoFirm: true,
  },
  {
    key: "client-dormant",
    label: "Client has not signed in lately",
    description:
      "When a client with an open case has not opened their portal for 30 days, nudge them that there is something waiting. At most one nudge a month per client.",
    kind: "dormant",
    noun: "reminder",
  },
]

/** How long without a sign-in before the dormant rule nudges a client. */
export const DORMANT_DAYS = 30

export function ruleByKey(key: string): AutomationRuleDef | undefined {
  return RULES.find((r) => r.key === key)
}

export interface AutomationRule extends AutomationRuleDef {
  enabled: boolean
  mode: AutomationMode
  /** The wording Regina has saved, or the shipped default. */
  subject: string
  body: string
}

/** One document a client is about to be told about. */
export interface QueuedDoc {
  id: string
  title: string
  link: string
  date: string | null
}

export interface QueueItem {
  id: number
  ruleKey: string
  clientId: string
  clientName: string
  clientEmail: string
  documents: QueuedDoc[]
  status: "pending" | "sent" | "dismissed" | "failed"
  createdAt: string
  decidedAt: string | null
  decidedBy: string | null
  error: string | null
}

let ready: Promise<void> | undefined

/**
 * Create the tables if they are not there. Once per server instance.
 *
 * Deliberately not silent about failure: unlike a missing nullable column,
 * nothing here degrades gracefully - a missing table means the scanner cannot
 * tell what it has already seen, and a scanner that cannot tell would email
 * everything again. Callers await this and stop if it throws.
 */
export function ensureAutomationTables(): Promise<void> {
  if (ready) return ready
  ready = (async () => {
    await sql`
      CREATE TABLE IF NOT EXISTS automation_rules (
        key TEXT PRIMARY KEY,
        enabled BOOLEAN NOT NULL DEFAULT false,
        mode TEXT NOT NULL DEFAULT 'approve',
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `
    // One row per document we have already accounted for. The row with
    // record_id = '__seeded__' is the marker that says "this rule has looked at
    // this client before", so a client whose board is genuinely empty today
    // still gets told about their first document tomorrow.
    await sql`
      CREATE TABLE IF NOT EXISTS automation_seen (
        rule_key TEXT NOT NULL,
        client_id TEXT NOT NULL,
        record_id TEXT NOT NULL,
        seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        PRIMARY KEY (rule_key, client_id, record_id)
      )
    `
    await sql`
      CREATE TABLE IF NOT EXISTS automation_queue (
        id SERIAL PRIMARY KEY,
        rule_key TEXT NOT NULL,
        client_id TEXT NOT NULL,
        client_name TEXT NOT NULL DEFAULT '',
        client_email TEXT NOT NULL DEFAULT '',
        documents JSONB NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        decided_at TIMESTAMPTZ,
        decided_by TEXT,
        error TEXT
      )
    `
    await sql`
      CREATE INDEX IF NOT EXISTS automation_queue_status_idx
        ON automation_queue (status, created_at DESC)
    `
    // The editable wording, added after the table shipped. Null means "use the
    // default", so an untouched rule follows the shipped wording for ever
    // rather than freezing a copy of whatever it said the day she opened it.
    await sql`ALTER TABLE automation_rules ADD COLUMN IF NOT EXISTS subject TEXT`
    await sql`ALTER TABLE automation_rules ADD COLUMN IF NOT EXISTS body TEXT`
  })()
  return ready
}

/** Every rule with its current setting. Rules never seen before read as off. */
export async function listRules(): Promise<AutomationRule[]> {
  await ensureAutomationTables()
  const r = await sql`SELECT key, enabled, mode, subject, body FROM automation_rules`
  const saved = new Map(r.rows.map((row) => [String(row.key), row]))
  return RULES.map((def) => {
    const row = saved.get(def.key)
    const fallback = DEFAULTS[def.kind] ?? DEFAULTS.documents
    const subject = row && typeof row.subject === "string" && row.subject.trim() ? row.subject : fallback.subject
    const body = row && typeof row.body === "string" && row.body.trim() ? row.body : fallback.body
    return {
      ...def,
      enabled: row ? Boolean(row.enabled) : false,
      mode: row && String(row.mode) === "auto" ? "auto" : "approve",
      subject,
      body,
    }
  })
}

export async function setRule(
  key: string,
  patch: { enabled?: boolean; mode?: AutomationMode; subject?: string | null; body?: string | null }
): Promise<void> {
  await ensureAutomationTables()
  const def = ruleByKey(key)
  if (!def) throw new Error("Unknown rule")
  const current = (await listRules()).find((r) => r.key === key)!
  const enabled = patch.enabled ?? current.enabled
  const mode = patch.mode ?? current.mode
  // null means "put it back to the default", which is why the column is
  // nullable rather than holding a copy of the default text.
  const subject =
    patch.subject === undefined ? current.subject : patch.subject === null ? null : patch.subject
  const body = patch.body === undefined ? current.body : patch.body === null ? null : patch.body
  await sql`
    INSERT INTO automation_rules (key, enabled, mode, subject, body, updated_at)
    VALUES (${key}, ${enabled}, ${mode}, ${subject}, ${body}, now())
    ON CONFLICT (key) DO UPDATE
      SET enabled = EXCLUDED.enabled, mode = EXCLUDED.mode,
          subject = EXCLUDED.subject, body = EXCLUDED.body, updated_at = now()
  `
}

const SEED_MARKER = "__seeded__"

/** Has this rule ever looked at this client? See safety rule 2. */
export async function hasSeenClient(ruleKey: string, clientId: string): Promise<boolean> {
  const r = await sql`
    SELECT 1 FROM automation_seen
    WHERE rule_key = ${ruleKey} AND client_id = ${clientId} AND record_id = ${SEED_MARKER}
    LIMIT 1
  `
  return r.rows.length > 0
}

/** Which of these record ids have we already accounted for? */
export async function seenRecordIds(ruleKey: string, clientId: string): Promise<Set<string>> {
  const r = await sql`
    SELECT record_id FROM automation_seen
    WHERE rule_key = ${ruleKey} AND client_id = ${clientId}
  `
  return new Set(r.rows.map((row) => String(row.record_id)))
}

/**
 * Record documents as accounted for. Called BEFORE anything is sent, so a
 * crash between marking and sending loses an email rather than sending the
 * same one on every run for ever. Losing one is recoverable by looking at the
 * portal; a loop that emails a client hourly is not.
 */
export async function markSeen(ruleKey: string, clientId: string, recordIds: string[]): Promise<void> {
  const ids = [...new Set([SEED_MARKER, ...recordIds])]
  for (const id of ids) {
    await sql`
      INSERT INTO automation_seen (rule_key, client_id, record_id)
      VALUES (${ruleKey}, ${clientId}, ${id})
      ON CONFLICT (rule_key, client_id, record_id) DO NOTHING
    `
  }
}

export async function enqueue(item: {
  ruleKey: string
  clientId: string
  clientName: string
  clientEmail: string
  documents: QueuedDoc[]
  status: "pending" | "sent" | "failed"
  error?: string | null
}): Promise<number> {
  const r = await sql`
    INSERT INTO automation_queue
      (rule_key, client_id, client_name, client_email, documents, status, decided_at, error)
    VALUES (
      ${item.ruleKey}, ${item.clientId}, ${item.clientName}, ${item.clientEmail},
      ${JSON.stringify(item.documents)}, ${item.status},
      ${item.status === "pending" ? null : new Date().toISOString()},
      ${item.error ?? null}
    )
    RETURNING id
  `
  return Number(r.rows[0]?.id ?? 0)
}

function toItem(row: Record<string, unknown>): QueueItem {
  const docs = row.documents
  return {
    id: Number(row.id),
    ruleKey: String(row.rule_key),
    clientId: String(row.client_id),
    clientName: String(row.client_name ?? ""),
    clientEmail: String(row.client_email ?? ""),
    documents: Array.isArray(docs) ? (docs as QueuedDoc[]) : [],
    status: String(row.status) as QueueItem["status"],
    createdAt: new Date(String(row.created_at)).toISOString(),
    decidedAt: row.decided_at ? new Date(String(row.decided_at)).toISOString() : null,
    decidedBy: row.decided_by ? String(row.decided_by) : null,
    error: row.error ? String(row.error) : null,
  }
}

export async function listQueue(status: "pending" | "history", limit = 40): Promise<QueueItem[]> {
  await ensureAutomationTables()
  const r =
    status === "pending"
      ? await sql`SELECT * FROM automation_queue WHERE status = 'pending' ORDER BY created_at DESC LIMIT ${limit}`
      : await sql`SELECT * FROM automation_queue WHERE status <> 'pending' ORDER BY COALESCE(decided_at, created_at) DESC LIMIT ${limit}`
  return r.rows.map(toItem)
}

export async function getQueueItem(id: number): Promise<QueueItem | null> {
  await ensureAutomationTables()
  const r = await sql`SELECT * FROM automation_queue WHERE id = ${id}`
  return r.rows[0] ? toItem(r.rows[0]) : null
}

export async function decideQueueItem(
  id: number,
  status: "sent" | "dismissed" | "failed",
  by: string,
  error?: string
): Promise<void> {
  await sql`
    UPDATE automation_queue
    SET status = ${status}, decided_at = now(), decided_by = ${by}, error = ${error ?? null}
    WHERE id = ${id}
  `
}
