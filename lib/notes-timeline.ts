// lib/notes-timeline.ts — live portal events for a client's Field Notes
// timeline, merged with manual notes. Events are QUERIED at render from the
// tables that already record them — nothing is copied, nothing drifts.
// Every source is fail-soft: one broken source never blanks the timeline.
import { sql } from "@/lib/db"
import type { ClientNote } from "@/lib/notes"

export interface TimelineEvent {
  id: string
  kind: "chat" | "message" | "upload" | "form" | "task" | "view"
  at: string
  sender?: "client" | "firm"
  smsStatus?: string | null
  detail: string
  // Where to open the file this entry is about: a portal download route for
  // files kept in the portal, or the Google Drive link for files sent there.
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

export async function fetchClientEvents(clientId: string, clientName?: string): Promise<TimelineEvent[]> {
  const cid = String(clientId)
  const who = clientActor(clientName)
  const [chat, legacy, taskFiles, firmTaskFiles, msgFiles, driveFiles, taskViews, msgViews, forms, doneTasks] = await Promise.all([
    sql`SELECT id, sender, body, sms_status, created_at FROM chat_messages
        WHERE client_id = ${cid} ORDER BY created_at DESC LIMIT ${PER_SOURCE_LIMIT}`.catch(() => ({ rows: [] as any[] })),
    sql`SELECT id, body, created_at FROM messages
        WHERE client_id = ${cid} ORDER BY created_at DESC LIMIT ${PER_SOURCE_LIMIT}`.catch(() => ({ rows: [] as any[] })),
    // Files on the client's own tasks. Who uploaded decides the wording: an
    // admin email means the firm sent it, anyone else is the client.
    sql`SELECT ta.id, ta.file_name, ta.created_at, ta.uploaded_by, ct.title,
               (au.email IS NOT NULL) AS by_firm
        FROM task_attachments ta
        LEFT JOIN admin_users au ON au.email = ta.uploaded_by
        LEFT JOIN client_tasks ct ON ct.id::text = ta.ref_id
        WHERE ta.client_id = ${cid} AND ta.scope = 'client_task'
        ORDER BY ta.created_at DESC LIMIT ${PER_SOURCE_LIMIT}`.catch(() => ({ rows: [] as any[] })),
    // Firm documents that reached this client through an assigned task: the
    // file hangs off the template, so it became available to them when the
    // task was assigned (whichever happened later).
    sql`SELECT ta.id, ta.file_name, ct.title,
               GREATEST(ta.created_at, ct.created_at) AS available_at
        FROM task_attachments ta
        JOIN client_tasks ct ON ct.template_id::text = ta.ref_id
        WHERE ta.scope = 'template' AND ct.client_id = ${cid}
        ORDER BY GREATEST(ta.created_at, ct.created_at) DESC LIMIT ${PER_SOURCE_LIMIT}`.catch(() => ({ rows: [] as any[] })),
    sql`SELECT ma.id, ma.file_name, ma.created_at, cm.sender
        FROM message_attachments ma JOIN chat_messages cm ON cm.id = ma.message_id
        WHERE cm.client_id = ${cid}
        ORDER BY ma.created_at DESC LIMIT ${PER_SOURCE_LIMIT}`.catch(() => ({ rows: [] as any[] })),
    // Files the client sent straight to the firm's Google Drive folder.
    sql`SELECT id, file_name, drive_status, url, created_at FROM dropzone_files
        WHERE uploaded_by = ${cid}
        ORDER BY created_at DESC LIMIT ${PER_SOURCE_LIMIT}`.catch(() => ({ rows: [] as any[] })),
    // The client opening a document, grouped per file per day so a client who
    // opens the same PDF five times reads as one entry, not five.
    sql`SELECT fv.file_id, ta.file_name, COUNT(*)::int AS opens, MAX(fv.created_at) AS last_at,
               to_char(MAX(fv.created_at) AT TIME ZONE 'America/New_York', 'YYYY-MM-DD') AS day
        FROM file_views fv JOIN task_attachments ta ON ta.id::text = fv.file_id
        WHERE fv.client_id = ${cid} AND fv.viewer_role = 'client' AND fv.scope = 'task'
        GROUP BY fv.file_id, ta.file_name, (fv.created_at AT TIME ZONE 'America/New_York')::date
        ORDER BY MAX(fv.created_at) DESC LIMIT ${PER_SOURCE_LIMIT}`.catch(() => ({ rows: [] as any[] })),
    sql`SELECT fv.file_id, ma.file_name, COUNT(*)::int AS opens, MAX(fv.created_at) AS last_at,
               to_char(MAX(fv.created_at) AT TIME ZONE 'America/New_York', 'YYYY-MM-DD') AS day
        FROM file_views fv JOIN message_attachments ma ON ma.id::text = fv.file_id
        WHERE fv.client_id = ${cid} AND fv.viewer_role = 'client' AND fv.scope = 'message'
        GROUP BY fv.file_id, ma.file_name, (fv.created_at AT TIME ZONE 'America/New_York')::date
        ORDER BY MAX(fv.created_at) DESC LIMIT ${PER_SOURCE_LIMIT}`.catch(() => ({ rows: [] as any[] })),
    sql`SELECT form_key, MAX(updated_at) AS updated_at, COUNT(*) AS answers
        FROM form_responses WHERE client_id = ${cid}
        GROUP BY form_key ORDER BY MAX(updated_at) DESC`.catch(() => ({ rows: [] as any[] })),
    sql`SELECT id, title, completed_at FROM client_tasks
        WHERE client_id = ${cid} AND status = 'done' AND completed_at IS NOT NULL
        ORDER BY completed_at DESC LIMIT ${PER_SOURCE_LIMIT}`.catch(() => ({ rows: [] as any[] })),
  ])

  const events: TimelineEvent[] = []
  for (const m of chat.rows) {
    const preview = String(m.body ?? "").slice(0, 120)
    events.push({
      id: `chat-${m.id}`,
      kind: "chat",
      at: String(m.created_at),
      sender: m.sender === "firm" ? "firm" : "client",
      smsStatus: m.sms_status ?? null,
      detail:
        m.sender === "firm"
          ? `You sent a message: "${preview}"`
          : m.sms_status === "inbound"
            ? `${who} texted: "${preview}"`
            : `${who} sent a message: "${preview}"`,
    })
  }
  for (const m of legacy.rows) {
    events.push({ id: `message-${m.id}`, kind: "message", at: String(m.created_at), sender: "firm", detail: `You sent a message: "${String(m.body ?? "").slice(0, 120)}"` })
  }
  for (const f of taskFiles.rows) {
    const onTask = f.title ? ` on the task "${f.title}"` : ""
    events.push({
      id: `upload-${f.id}`,
      kind: "upload",
      at: String(f.created_at),
      sender: f.by_firm ? "firm" : "client",
      detail: f.by_firm
        ? `You sent ${f.file_name}${onTask}`
        : `${who} uploaded ${f.file_name}${onTask}`,
      href: `/api/task-files/${f.id}`,
      linkLabel: "Open file",
    })
  }
  for (const f of firmTaskFiles.rows) {
    events.push({
      id: `tmplfile-${f.id}`,
      kind: "upload",
      at: String(f.available_at),
      sender: "firm",
      detail: `You sent ${f.file_name}${f.title ? ` with the task "${f.title}"` : ""}`,
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
      sender: firm ? "firm" : "client",
      detail: firm ? `You attached ${f.file_name} to a message` : `${who} attached ${f.file_name} to a message`,
      href: `/api/message-files/${f.id}`,
      linkLabel: "Open file",
    })
  }
  for (const f of driveFiles.rows) {
    const failed = String(f.drive_status ?? "") === "failed"
    const driveLink = String(f.url ?? "")
    events.push({
      id: `drive-${f.id}`,
      kind: "upload",
      at: String(f.created_at),
      sender: "client",
      detail: failed
        ? `${who} sent ${f.file_name} — it did not reach the Drive folder`
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
        sender: "client",
        detail: `${who} opened ${v.file_name}${opens > 1 ? ` (${opens} times that day)` : ""}`,
        href: scope === "task" ? `/api/task-files/${v.file_id}` : `/api/message-files/${v.file_id}`,
        linkLabel: "Open file",
      })
    }
  }
  pushViews(taskViews.rows, "task")
  pushViews(msgViews.rows, "message")
  for (const f of forms.rows) {
    events.push({ id: `form-${f.form_key}`, kind: "form", at: String(f.updated_at), sender: "client", detail: `${who} updated the ${String(f.form_key).replace(/-/g, " ")} form (${f.answers} answers)` })
  }
  for (const t of doneTasks.rows) {
    events.push({ id: `task-${t.id}`, kind: "task", at: String(t.completed_at), sender: "client", detail: `${who} completed the task: ${t.title}` })
  }
  return events
}
