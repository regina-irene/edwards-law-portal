// lib/task-progress.ts — pure helpers behind the admin Tasks screen: what
// state an assigned task is in, how a client's caseload rolls up, and the
// accent colour each stage carries. No React, no data access, so it can be
// unit-tested on its own.

export interface AssignedTask {
  id: string
  client_id: string
  title: string
  status: "pending" | "done"
  due_date: string | null
  stage: string | null
  tag: string | null
}

export type TaskState = "done" | "overdue" | "soon" | "open"

// due_date is a DATE column: compare calendar days, never timezone-shifted
// instants, or a task due today reads as overdue in the evening.
export function todayInEastern(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now)
}

export function dayOf(due: string | null): string {
  return due ? String(due).slice(0, 10) : ""
}

// Whole days from today to the due date; negative means it's in the past.
export function daysUntil(due: string | null, today = todayInEastern()): number | null {
  const day = dayOf(due)
  if (!day) return null
  const a = Date.parse(`${today}T00:00:00Z`)
  const b = Date.parse(`${day}T00:00:00Z`)
  if (Number.isNaN(a) || Number.isNaN(b)) return null
  return Math.round((b - a) / 86_400_000)
}

export function taskState(task: AssignedTask, today = todayInEastern()): TaskState {
  if (task.status === "done") return "done"
  const days = daysUntil(task.due_date, today)
  if (days === null) return "open"
  if (days < 0) return "overdue"
  if (days <= 7) return "soon"
  return "open"
}

export const STATE_LABEL: Record<TaskState, string> = {
  done: "Done",
  overdue: "Overdue",
  soon: "Due soon",
  open: "Open",
}

// Tailwind classes per state — one place so pills read the same everywhere.
export const STATE_CLASS: Record<TaskState, string> = {
  done: "bg-green-100 text-green-800",
  overdue: "bg-red-100 text-red-800",
  soon: "bg-amber-100 text-amber-800",
  open: "bg-gray-100 text-gray-600",
}

export interface ClientProgress {
  clientId: string
  label: string
  tasks: AssignedTask[]
  total: number
  done: number
  overdue: number
  dueThisWeek: number
  percent: number
  // how overdue the worst task is, for sorting
  worstOverdueDays: number
}

export function progressFor(clientId: string, label: string, tasks: AssignedTask[], today = todayInEastern()): ClientProgress {
  let done = 0
  let overdue = 0
  let dueThisWeek = 0
  let worstOverdueDays = 0
  for (const t of tasks) {
    const state = taskState(t, today)
    if (state === "done") done++
    if (state === "overdue") {
      overdue++
      const days = daysUntil(t.due_date, today)
      if (days !== null) worstOverdueDays = Math.max(worstOverdueDays, -days)
    }
    if (state === "soon") dueThisWeek++
  }
  const total = tasks.length
  return {
    clientId,
    label,
    tasks,
    total,
    done,
    overdue,
    dueThisWeek,
    percent: total === 0 ? 0 : Math.round((done / total) * 100),
    worstOverdueDays,
  }
}

// Most overdue first, then by name — the order Regina works in.
export function sortProgress(list: ClientProgress[]): ClientProgress[] {
  return [...list].sort((a, b) => {
    if (b.worstOverdueDays !== a.worstOverdueDays) return b.worstOverdueDays - a.worstOverdueDays
    if (b.overdue !== a.overdue) return b.overdue - a.overdue
    return a.label.localeCompare(b.label, undefined, { sensitivity: "base" })
  })
}

// A stable accent per stage, derived from its position so stages Regina adds
// later get a colour without any code change.
const STAGE_ACCENTS = ["#1B2D45", "#4F86D6", "#2F7A63", "#8A5A2B", "#7A4E7E", "#B4622B", "#3F6F8F"]

export function stageAccent(index: number): string {
  return STAGE_ACCENTS[index % STAGE_ACCENTS.length]
}

// Does this text match the search box? Case-insensitive substring over any of
// the fields passed in.
export function matchesSearch(query: string, ...fields: (string | null | undefined)[]): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  return fields.some((f) => (f ?? "").toLowerCase().includes(q))
}
