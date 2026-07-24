// lib/notes-timeline.ts — live portal events for a client's Field Notes
// timeline, merged with manual notes. Events are QUERIED at render from the
// tables that already record them — nothing is copied, nothing drifts.
// Every source is fail-soft: one broken source never blanks the timeline.
import { sql } from "@/lib/db"
import type { ClientNote } from "@/lib/notes"

export interface TimelineEvent {
  id: string
  kind: "chat" | "message" | "upload" | "form" | "task"
  at: string
  sender?: "client" | "firm"
  smsStatus?: string | null
  detail: string
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

export async function fetchClientEvents(clientId: string): Promise<TimelineEvent[]> {
  const cid = String(clientId)
  const [chat, legacy, taskFiles, msgFiles, forms, doneTasks] = await Promise.all([
    sql`SELECT id, sender, body, sms_status, created_at FROM chat_messages
        WHERE client_id = ${cid} ORDER BY created_at DESC LIMIT ${PER_SOURCE_LIMIT}`.catch(() => ({ rows: [] as any[] })),
    sql`SELECT id, body, created_at FROM messages
        WHERE client_id = ${cid} ORDER BY created_at DESC LIMIT ${PER_SOURCE_LIMIT}`.catch(() => ({ rows: [] as any[] })),
    sql`SELECT id, file_name, created_at FROM task_attachments
        WHERE client_id = ${cid} AND scope = 'client_task'
        ORDER BY created_at DESC LIMIT ${PER_SOURCE_LIMIT}`.catch(() => ({ rows: [] as any[] })),
    sql`SELECT ma.id, ma.file_name, ma.created_at, cm.sender
        FROM message_attachments ma JOIN chat_messages cm ON cm.id = ma.message_id
        WHERE cm.client_id = ${cid}
        ORDER BY ma.created_at DESC LIMIT ${PER_SOURCE_LIMIT}`.catch(() => ({ rows: [] as any[] })),
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
            ? `Client texted: "${preview}"`
            : `Client sent a message: "${preview}"`,
    })
  }
  for (const m of legacy.rows) {
    events.push({ id: `message-${m.id}`, kind: "message", at: String(m.created_at), sender: "firm", detail: `You sent a message: "${String(m.body ?? "").slice(0, 120)}"` })
  }
  for (const f of taskFiles.rows) {
    events.push({ id: `upload-${f.id}`, kind: "upload", at: String(f.created_at), sender: "client", detail: `Client uploaded ${f.file_name}` })
  }
  for (const f of msgFiles.rows) {
    const who = f.sender === "firm" ? "You" : "Client"
    events.push({ id: `msgfile-${f.id}`, kind: "upload", at: String(f.created_at), sender: f.sender === "firm" ? "firm" : "client", detail: `${who} attached ${f.file_name}` })
  }
  for (const f of forms.rows) {
    events.push({ id: `form-${f.form_key}`, kind: "form", at: String(f.updated_at), sender: "client", detail: `Client updated the ${String(f.form_key).replace(/-/g, " ")} form (${f.answers} answers)` })
  }
  for (const t of doneTasks.rows) {
    events.push({ id: `task-${t.id}`, kind: "task", at: String(t.completed_at), sender: "client", detail: `Task completed: ${t.title}` })
  }
  return events
}
