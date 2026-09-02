// lib/notes-timeline.ts - live portal activity for Field Notes, merged with
// manual notes. Events are QUERIED at render from the tables that already
// record them - nothing is copied, nothing drifts.
//
// The same queries serve one case (the per-case timeline) and every case at
// once (the hub's running log): pass a client id to narrow, or "" for the lot.
// Every source is fail-soft: one broken source never blanks the log.
import { sql } from "@/lib/db"
import type { ClientNote } from "@/lib/notes"

export interface TimelineEvent {
  id: string
  kind: "chat" | "message" | "upload" | "form" | "task" | "view"
  at: string
  sender?: "client" | "firm"
  smsStatus?: string | null
  detail: string
  // Which case this belongs to - the running log needs it to label and link
  // each entry; the per-case timeline already knows.
  clientId?: string
  /**
   * Where this entry LEADS (2026-08-22).
   *
   * It used to mean "open the file" and only uploads carried one, so a client
   * message in the log named a message you then had to go and find in the
   * Message Center by hand - which is the entry you most often want to act on,
   * because it is the one waiting for a reply. Every kind that has somewhere
   * sensible to go now carries a destination:
   *
   *   chat / message   the conversation, with that client already selected
   *   upload / view    the file, in the portal or in Drive
   *   form             that client's answers to that form
   *   task             the client's task list
   */
  href?: string
  linkLabel?: string
}

// Airtable names read "Last | First"; the timeline says "Client Cleon Grey …"
// so an entry names the person, not a generic role.
export function clientProseName(name: string | null | undefined): string {
  const parts = (name ?? "").split("|").map((s) => s.trim()).filter(Boolean)
  const last = parts[0] ?? ""
  const first = parts[1] ?? ""
  if (last && first) return `${first} ${last}`
  return last || first || ""
}

// "Client Cleon Grey" when we know who it is, plain "Client" when we don't.
export function clientActor(displayName?: string): string {
  const n = (displayName ?? "").trim()
  return n ? `Client ${n}` : "Client"
}

/**
 * Who at the firm did it, by first name (2026-08-20).
 *
 * The log used to say "You sent …" for anything the firm did. That reads fine
 * for exactly one person on exactly one screen, and wrongly everywhere else: a
 * second person at the firm reading the log sees "You" against something they
 * never did, and a printed case log records an action with no actor at all.
 * A name is also simply more useful - "Regina sent" tells you something "You
 * sent" does not.
 *
 * `who` is the admin's stored name or email where the row has one. Rows that
 * carry no author (chat_messages records only 'firm', not which person) fall
 * back to FIRM_SENDER_NAME.
 */
const FIRM_SENDER_NAME = process.env.FIRM_SENDER_NAME || "Regina"

export function firmActor(who?: string | null): string {
  const raw = (who ?? "").trim()
  if (!raw) return FIRM_SENDER_NAME
  // A stored name ("Regina Edwards") gives its first word; an email
  // ("regina@edwardsfamilylaw.com") gives the part before the @, capitalised.
  const name = raw.includes("@") ? raw.split("@")[0].replace(/[._-]+/g, " ") : raw
  const first = name.split(/\s+/).filter(Boolean)[0] ?? ""
  if (!first) return FIRM_SENDER_NAME
  return first.charAt(0).toUpperCase() + first.slice(1)
}

export type TimelineItem =
  | { type: "note"; at: string; note: ClientNote }
  | { type: "event"; at: string; event: TimelineEvent }

export function mergeTimeline(notes: ClientNote[], events: TimelineEvent[]): TimelineItem[] {
  const items: TimelineItem[] = [
    ...notes.map((n): TimelineItem => ({ type: "note", at: String(n.created_at), note: n })),
    ...events.map((e): TimelineItem => ({ type: "event", at: String(e.at), event: e })),
  ]
  return items.sort((a, b) => {
    const t = new Date(b.at).getTime() - new Date(a.at).getTime()
    if (t !== 0) return t
    const ida = a.type === "note" ? a.note.id : a.event.id
    const idb = b.type === "note" ? b.note.id : b.event.id
    return idb.localeCompare(ida)
  })
}

const PER_SOURCE_LIMIT = 500

// Names the client in an entry. The per-case timeline passes one name; the
// running log looks each row's client up.
export type NameLookup = (clientId: string) => string

async function fetchEvents(clientId: string, nameOf: NameLookup, perSource: number): Promise<TimelineEvent[]> {
  // An empty id means "every case". Each source therefore has TWO shapes - an
  // unfiltered read and one narrowed to a single client_id - picked here. The
  // old single query used `(${cid} = '' OR client_id = ${cid})`, and that OR
  // hides the client_id from the planner: it cannot use a client_id index and
  // falls back to scanning the table even when a case is named.
  const cid = String(clientId ?? "")
  const everyCase = cid === ""
  const [chat, legacy, taskFiles, firmTaskFiles, msgFiles, driveFiles, taskViews, msgViews, forms, doneTasks] = await Promise.all([
    (everyCase
      ? sql`SELECT id, client_id, sender, body, sms_status, created_at FROM chat_messages
            ORDER BY created_at DESC LIMIT ${perSource}`
      : sql`SELECT id, client_id, sender, body, sms_status, created_at FROM chat_messages
            WHERE client_id = ${cid}
            ORDER BY created_at DESC LIMIT ${perSource}`
    ).catch(() => ({ rows: [] as any[] })),
    (everyCase
      ? sql`SELECT id, client_id, body, created_at FROM messages
            ORDER BY created_at DESC LIMIT ${perSource}`
      : sql`SELECT id, client_id, body, created_at FROM messages
            WHERE client_id = ${cid}
            ORDER BY created_at DESC LIMIT ${perSource}`
    ).catch(() => ({ rows: [] as any[] })),
    // Files on a client's own tasks. Who uploaded decides the wording: an
    // admin email means the firm sent it, anyone else is the client.
    // ct.id = ta.ref_id::uuid, not ct.id::text = ta.ref_id, so the client_tasks
    // primary key index is usable. Safe here because ta.scope = 'client_task'
    // is a restriction on the scanned table: it is applied before the join
    // condition is ever evaluated, and client_task ref_ids are always a real
    // client_tasks.id (the upload route verifies the task exists first).
    (everyCase
      ? sql`SELECT ta.id, ta.client_id, ta.file_name, ta.created_at, ta.uploaded_by, ct.title,
                   au.name AS firm_name,
                   (au.email IS NOT NULL) AS by_firm
            FROM task_attachments ta
            LEFT JOIN admin_users au ON au.email = ta.uploaded_by
            LEFT JOIN client_tasks ct ON ct.id = ta.ref_id::uuid
            WHERE ta.scope = 'client_task' AND ta.client_id IS NOT NULL
            ORDER BY ta.created_at DESC LIMIT ${perSource}`
      : sql`SELECT ta.id, ta.client_id, ta.file_name, ta.created_at, ta.uploaded_by, ct.title,
                   au.name AS firm_name,
                   (au.email IS NOT NULL) AS by_firm
            FROM task_attachments ta
            LEFT JOIN admin_users au ON au.email = ta.uploaded_by
            LEFT JOIN client_tasks ct ON ct.id = ta.ref_id::uuid
            WHERE ta.scope = 'client_task' AND ta.client_id IS NOT NULL
              AND ta.client_id = ${cid}
            ORDER BY ta.created_at DESC LIMIT ${perSource}`
    ).catch(() => ({ rows: [] as any[] })),
    // Firm documents that reached a client through an assigned task: the file
    // hangs off the template, so it became available to them when the task was
    // assigned (whichever happened later).
    // The ::text cast stays on THIS one: these rows are ta.scope = 'template',
    // and a template ref_id is whatever the uploader passed - it is not checked
    // against task_templates, so ta.ref_id::uuid could throw at runtime.
    (everyCase
      ? sql`SELECT ta.id, ct.client_id, ta.file_name, ct.title,
                   GREATEST(ta.created_at, ct.created_at) AS available_at
            FROM task_attachments ta
            JOIN client_tasks ct ON ct.template_id::text = ta.ref_id
            WHERE ta.scope = 'template'
            ORDER BY GREATEST(ta.created_at, ct.created_at) DESC LIMIT ${perSource}`
      : sql`SELECT ta.id, ct.client_id, ta.file_name, ct.title,
                   GREATEST(ta.created_at, ct.created_at) AS available_at
            FROM task_attachments ta
            JOIN client_tasks ct ON ct.template_id::text = ta.ref_id
            WHERE ta.scope = 'template' AND ct.client_id = ${cid}
            ORDER BY GREATEST(ta.created_at, ct.created_at) DESC LIMIT ${perSource}`
    ).catch(() => ({ rows: [] as any[] })),
    (everyCase
      ? sql`SELECT ma.id, cm.client_id, ma.file_name, ma.created_at, cm.sender
            FROM message_attachments ma JOIN chat_messages cm ON cm.id = ma.message_id
            ORDER BY ma.created_at DESC LIMIT ${perSource}`
      : sql`SELECT ma.id, cm.client_id, ma.file_name, ma.created_at, cm.sender
            FROM message_attachments ma JOIN chat_messages cm ON cm.id = ma.message_id
            WHERE cm.client_id = ${cid}
            ORDER BY ma.created_at DESC LIMIT ${perSource}`
    ).catch(() => ({ rows: [] as any[] })),
    // Files a client sent straight to the firm's Google Drive folder.
    (everyCase
      ? sql`SELECT id, uploaded_by AS client_id, file_name, drive_status, url, created_at FROM dropzone_files
            WHERE uploaded_by IS NOT NULL
            ORDER BY created_at DESC LIMIT ${perSource}`
      : sql`SELECT id, uploaded_by AS client_id, file_name, drive_status, url, created_at FROM dropzone_files
            WHERE uploaded_by IS NOT NULL AND uploaded_by = ${cid}
            ORDER BY created_at DESC LIMIT ${perSource}`
    ).catch(() => ({ rows: [] as any[] })),
    // A client opening a document, grouped per file per day so someone who
    // opens the same PDF five times reads as one entry, not five.
    (everyCase
      ? sql`SELECT fv.file_id, fv.client_id, ta.file_name, COUNT(*)::int AS opens, MAX(fv.created_at) AS last_at,
                   to_char(MAX(fv.created_at) AT TIME ZONE 'America/New_York', 'YYYY-MM-DD') AS day
            FROM file_views fv JOIN task_attachments ta ON ta.id::text = fv.file_id
            WHERE fv.viewer_role = 'client' AND fv.scope = 'task' AND fv.client_id IS NOT NULL
            GROUP BY fv.file_id, fv.client_id, ta.file_name, (fv.created_at AT TIME ZONE 'America/New_York')::date
            ORDER BY MAX(fv.created_at) DESC LIMIT ${perSource}`
      : sql`SELECT fv.file_id, fv.client_id, ta.file_name, COUNT(*)::int AS opens, MAX(fv.created_at) AS last_at,
                   to_char(MAX(fv.created_at) AT TIME ZONE 'America/New_York', 'YYYY-MM-DD') AS day
            FROM file_views fv JOIN task_attachments ta ON ta.id::text = fv.file_id
            WHERE fv.viewer_role = 'client' AND fv.scope = 'task' AND fv.client_id IS NOT NULL
              AND fv.client_id = ${cid}
            GROUP BY fv.file_id, fv.client_id, ta.file_name, (fv.created_at AT TIME ZONE 'America/New_York')::date
            ORDER BY MAX(fv.created_at) DESC LIMIT ${perSource}`
    ).catch(() => ({ rows: [] as any[] })),
    (everyCase
      ? sql`SELECT fv.file_id, fv.client_id, ma.file_name, COUNT(*)::int AS opens, MAX(fv.created_at) AS last_at,
                   to_char(MAX(fv.created_at) AT TIME ZONE 'America/New_York', 'YYYY-MM-DD') AS day
            FROM file_views fv JOIN message_attachments ma ON ma.id::text = fv.file_id
            WHERE fv.viewer_role = 'client' AND fv.scope = 'message' AND fv.client_id IS NOT NULL
            GROUP BY fv.file_id, fv.client_id, ma.file_name, (fv.created_at AT TIME ZONE 'America/New_York')::date
            ORDER BY MAX(fv.created_at) DESC LIMIT ${perSource}`
      : sql`SELECT fv.file_id, fv.client_id, ma.file_name, COUNT(*)::int AS opens, MAX(fv.created_at) AS last_at,
                   to_char(MAX(fv.created_at) AT TIME ZONE 'America/New_York', 'YYYY-MM-DD') AS day
            FROM file_views fv JOIN message_attachments ma ON ma.id::text = fv.file_id
            WHERE fv.viewer_role = 'client' AND fv.scope = 'message' AND fv.client_id IS NOT NULL
              AND fv.client_id = ${cid}
            GROUP BY fv.file_id, fv.client_id, ma.file_name, (fv.created_at AT TIME ZONE 'America/New_York')::date
            ORDER BY MAX(fv.created_at) DESC LIMIT ${perSource}`
    ).catch(() => ({ rows: [] as any[] })),
    (everyCase
      ? sql`SELECT client_id, form_key, MAX(updated_at) AS updated_at, COUNT(*) AS answers
            FROM form_responses
            GROUP BY client_id, form_key ORDER BY MAX(updated_at) DESC LIMIT ${perSource}`
      : sql`SELECT client_id, form_key, MAX(updated_at) AS updated_at, COUNT(*) AS answers
            FROM form_responses WHERE client_id = ${cid}
            GROUP BY client_id, form_key ORDER BY MAX(updated_at) DESC LIMIT ${perSource}`
    ).catch(() => ({ rows: [] as any[] })),
    (everyCase
      ? sql`SELECT id, client_id, title, completed_at FROM client_tasks
            WHERE status = 'done' AND completed_at IS NOT NULL
            ORDER BY completed_at DESC LIMIT ${perSource}`
      : sql`SELECT id, client_id, title, completed_at FROM client_tasks
            WHERE status = 'done' AND completed_at IS NOT NULL
              AND client_id = ${cid}
            ORDER BY completed_at DESC LIMIT ${perSource}`
    ).catch(() => ({ rows: [] as any[] })),
  ])

  const events: TimelineEvent[] = []
  const whoFor = (row: { client_id?: unknown }) => clientActor(nameOf(String(row.client_id ?? "")))
  const caseOf = (row: { client_id?: unknown }) => String(row.client_id ?? "") || undefined

  for (const m of chat.rows) {
    const preview = String(m.body ?? "").slice(0, 120)
    const who = whoFor(m)
    events.push({
      id: `chat-${m.id}`,
      kind: "chat",
      at: String(m.created_at),
      clientId: caseOf(m),
      // ?c= is what the Message Center already reads to preselect a
      // conversation, so this lands on the thread ready to reply.
      href: caseOf(m) ? `/admin/messages?c=${encodeURIComponent(caseOf(m)!)}` : undefined,
      linkLabel: "Open conversation",
      sender: m.sender === "firm" ? "firm" : "client",
      smsStatus: m.sms_status ?? null,
      detail:
        m.sender === "firm"
          ? `${firmActor()} sent a message: "${preview}"`
          : m.sms_status === "inbound"
            ? `${who} texted: "${preview}"`
            : `${who} sent a message: "${preview}"`,
    })
  }
  for (const m of legacy.rows) {
    events.push({
      id: `message-${m.id}`,
      kind: "message",
      at: String(m.created_at),
      clientId: caseOf(m),
      href: caseOf(m) ? `/admin/messages?c=${encodeURIComponent(caseOf(m)!)}` : undefined,
      linkLabel: "Open conversation",
      sender: "firm",
      detail: `${firmActor()} sent a message: "${String(m.body ?? "").slice(0, 120)}"`,
    })
  }
  for (const f of taskFiles.rows) {
    const onTask = f.title ? ` on the task "${f.title}"` : ""
    events.push({
      id: `upload-${f.id}`,
      kind: "upload",
      at: String(f.created_at),
      clientId: caseOf(f),
      sender: f.by_firm ? "firm" : "client",
      detail: f.by_firm
        // This row DOES know who: task_attachments records the uploader and the
        // query joins admin_users for their name.
        ? `${firmActor(typeof f.firm_name === "string" ? f.firm_name : (f.uploaded_by as string))} sent ${f.file_name}${onTask}`
        : `${whoFor(f)} uploaded ${f.file_name}${onTask}`,
      href: `/api/task-files/${f.id}`,
      linkLabel: "Open file",
    })
  }
  for (const f of firmTaskFiles.rows) {
    events.push({
      id: `tmplfile-${f.id}-${f.client_id}`,
      kind: "upload",
      at: String(f.available_at),
      clientId: caseOf(f),
      sender: "firm",
      detail: `${firmActor()} sent ${f.file_name}${f.title ? ` with the task "${f.title}"` : ""}`,
      href: `/api/task-files/${f.id}`,
      linkLabel: "Open file",
    })
  }
  for (const f of msgFiles.rows) {
    const firm = f.sender === "firm"
    events.push({
      id: `msgfile-${f.id}`,
      kind: "upload",
      at: String(f.created_at),
      clientId: caseOf(f),
      sender: firm ? "firm" : "client",
      detail: firm ? `${firmActor()} attached ${f.file_name} to a message` : `${whoFor(f)} attached ${f.file_name} to a message`,
      href: `/api/message-files/${f.id}`,
      linkLabel: "Open file",
    })
  }
  for (const f of driveFiles.rows) {
    const failed = String(f.drive_status ?? "") === "failed"
    const driveLink = String(f.url ?? "")
    const who = whoFor(f)
    events.push({
      id: `drive-${f.id}`,
      kind: "upload",
      at: String(f.created_at),
      clientId: caseOf(f),
      sender: "client",
      detail: failed
        ? `${who} sent ${f.file_name} - it did not reach the Drive folder`
        : `${who} sent ${f.file_name} to the firm's Drive folder`,
      href: !failed && driveLink ? driveLink : undefined,
      linkLabel: "Open in Drive",
    })
  }
  const pushViews = (rows: any[], scope: "task" | "message") => {
    for (const v of rows) {
      const opens = Number(v.opens ?? 1)
      events.push({
        id: `view-${scope}-${v.file_id}-${v.day}`,
        kind: "view",
        at: String(v.last_at),
        clientId: caseOf(v),
        sender: "client",
        detail: `${whoFor(v)} opened ${v.file_name}${opens > 1 ? ` (${opens} times that day)` : ""}`,
        href: scope === "task" ? `/api/task-files/${v.file_id}` : `/api/message-files/${v.file_id}`,
        linkLabel: "Open file",
      })
    }
  }
  pushViews(taskViews.rows, "task")
  pushViews(msgViews.rows, "message")
  for (const f of forms.rows) {
    events.push({
      id: `form-${f.client_id}-${f.form_key}`,
      kind: "form",
      at: String(f.updated_at),
      clientId: caseOf(f),
      sender: "client",
      detail: `${whoFor(f)} updated the ${String(f.form_key).replace(/-/g, " ")} form (${f.answers} answers)`,
      href: caseOf(f)
        ? `/admin/forms/${encodeURIComponent(String(f.form_key))}/${encodeURIComponent(caseOf(f)!)}`
        : undefined,
      linkLabel: "Open answers",
    })
  }
  for (const t of doneTasks.rows) {
    events.push({
      id: `task-${t.id}`,
      kind: "task",
      at: String(t.completed_at),
      clientId: caseOf(t),
      sender: "client",
      detail: `${whoFor(t)} completed the task: ${t.title}`,
      href: "/admin/tasks",
      linkLabel: "Open tasks",
    })
  }
  return events
}

// One case's activity.
export async function fetchClientEvents(clientId: string, clientName?: string): Promise<TimelineEvent[]> {
  return fetchEvents(String(clientId), () => clientName ?? "", PER_SOURCE_LIMIT)
}

// Every case's activity, for the hub's running log. Capped per source so a
// firm-wide read stays quick; the caller sorts and trims the merged result.
export async function fetchAllEvents(nameOf: NameLookup, perSource = 150): Promise<TimelineEvent[]> {
  return fetchEvents("", nameOf, perSource)
}
