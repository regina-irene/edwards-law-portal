"use client"
// components/admin/tasks/ProgressTab.tsx — where each client's caseload
// stands. One collapsed card per client, most overdue first, so the work that
// needs chasing is at the top.
import { useState } from "react"
import { progressFor, sortProgress, taskState, matchesSearch, dayOf, type ClientProgress } from "@/lib/task-progress"
import { StatusPill, IconButton, ConfirmDialog, InlineError } from "./bits"
import type { ClientTask } from "./types"

function fmtDue(due: string): string {
  const [y, m, d] = dayOf(due).split("-")
  return y && m && d ? `${Number(m)}/${Number(d)}/${y}` : due
}

export function ClientProgressCard({
  progress,
  expanded,
  onToggle,
  onDueDate,
  onStatus,
  onRemove,
  compact = false,
}: {
  progress: ClientProgress
  expanded: boolean
  onToggle: () => void
  onDueDate: (taskId: string, due: string) => void
  onStatus: (taskId: string, status: "pending" | "done") => void
  onRemove: (task: ClientTask) => void
  compact?: boolean
}) {
  const byStage = progress.tasks.reduce<Record<string, ClientTask[]>>((acc, t) => {
    ;(acc[t.stage ?? "Other"] ??= []).push(t as ClientTask)
    return acc
  }, {})

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="w-full text-left px-4 py-3 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500"
      >
        <div className="flex items-center gap-3">
          <span className={`text-gray-400 transition-transform ${expanded ? "rotate-90" : ""}`} aria-hidden="true">▶</span>
          <span className="text-sm font-semibold text-gray-900 flex-1 min-w-0 truncate">{progress.label}</span>
          {progress.overdue > 0 && (
            <span className="text-[11px] px-2 py-0.5 rounded-full font-semibold bg-red-100 text-red-800 whitespace-nowrap">
              {progress.overdue} overdue
            </span>
          )}
          <span className="text-xs text-gray-500 whitespace-nowrap">{progress.done} of {progress.total} done</span>
        </div>
        <div className="mt-2 ml-6 h-1.5 rounded-full bg-gray-100 overflow-hidden">
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${progress.percent}%`, background: progress.overdue > 0 ? "#DC2626" : "#2F7A63" }}
          />
        </div>
      </button>

      {expanded && (
        <div className="border-t border-gray-100">
          {Object.entries(byStage).map(([stage, list]) => (
            <div key={stage}>
              <p className="px-4 py-1.5 bg-gray-50 text-[11px] font-semibold uppercase tracking-wide text-gray-500">{stage}</p>
              <ul className="divide-y divide-gray-100">
                {list.map((t) => {
                  const state = taskState(t)
                  return (
                    <li key={t.id} className="flex items-center gap-3 px-4 py-2 flex-wrap hover:bg-blue-50/40 transition-colors">
                      <span className={`flex-1 min-w-0 text-sm ${t.status === "done" ? "text-gray-400 line-through" : "text-gray-800"}`}>
                        {t.title}
                      </span>
                      <StatusPill state={state} />
                      {!compact && (
                        <label className="flex items-center gap-1.5 text-xs text-gray-500">
                          Due
                          <input
                            type="date"
                            value={dayOf(t.due_date)}
                            onChange={(e) => onDueDate(t.id, e.target.value)}
                            aria-label={`Due date for ${t.title}`}
                            className="px-2 py-1 border border-gray-300 rounded-lg text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </label>
                      )}
                      {compact && t.due_date && <span className="text-xs text-gray-400">Due {fmtDue(t.due_date)}</span>}
                      {!compact && (
                        <span className="flex items-center gap-0.5">
                          {t.due_date && (
                            <IconButton label={`Clear the due date on ${t.title}`} onClick={() => onDueDate(t.id, "")}>🚫</IconButton>
                          )}
                          <IconButton
                            label={t.status === "done" ? `Reopen ${t.title}` : `Mark ${t.title} done`}
                            active={t.status === "done"}
                            onClick={() => onStatus(t.id, t.status === "done" ? "pending" : "done")}
                          >
                            ✓
                          </IconButton>
                          <IconButton label={`Remove ${t.title} from this client`} danger onClick={() => onRemove(t)}>🗑️</IconButton>
                        </span>
                      )}
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function ProgressTab({
  tasks,
  labelOf,
  search,
  reload,
}: {
  tasks: ClientTask[]
  labelOf: (clientId: string) => string
  search: string
  reload: () => Promise<void> | void
}) {
  const [expanded, setExpanded] = useState<string[]>([])
  const [overdueOnly, setOverdueOnly] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<{ title: string; body: string; run: () => void } | null>(null)

  const visible = tasks.filter((t) => matchesSearch(search, t.title, t.stage, t.tag, labelOf(t.client_id)))
  const byClient = visible.reduce<Record<string, ClientTask[]>>((acc, t) => {
    ;(acc[t.client_id] ??= []).push(t)
    return acc
  }, {})

  const all = sortProgress(
    Object.entries(byClient).map(([clientId, list]) => progressFor(clientId, labelOf(clientId), list))
  )
  const cards = overdueOnly ? all.filter((p) => p.overdue > 0) : all

  const totals = all.reduce(
    (acc, p) => ({
      clients: acc.clients + (p.done < p.total ? 1 : 0),
      overdue: acc.overdue + p.overdue,
      soon: acc.soon + p.dueThisWeek,
    }),
    { clients: 0, overdue: 0, soon: 0 }
  )

  async function patch(body: Record<string, unknown>) {
    setError(null)
    const res = await fetch("/api/admin/tasks", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).catch(() => null)
    if (!res?.ok) { setError("That change didn't save."); return }
    await reload()
  }

  function removeTask(t: ClientTask) {
    setConfirm({
      title: `Remove “${t.title}” from ${labelOf(t.client_id)}?`,
      body: "The client stops seeing this task. The task stays on your board for other clients.",
      run: async () => {
        setConfirm(null)
        setError(null)
        const res = await fetch("/api/admin/tasks", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: t.id, type: "task" }),
        }).catch(() => null)
        if (!res?.ok) { setError("Couldn't remove that task."); return }
        await reload()
      },
    })
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white rounded-xl border border-gray-200 px-4 py-3">
          <p className="text-2xl font-semibold text-gray-900">{totals.clients}</p>
          <p className="text-xs text-gray-500">clients with open tasks</p>
        </div>
        <button
          type="button"
          onClick={() => setOverdueOnly((v) => !v)}
          aria-pressed={overdueOnly}
          className={`text-left rounded-xl border px-4 py-3 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${
            overdueOnly ? "border-red-300 bg-red-50" : "border-gray-200 bg-white hover:border-red-200"
          }`}
        >
          <p className="text-2xl font-semibold text-red-700">{totals.overdue}</p>
          <p className="text-xs text-gray-500">
            overdue {totals.overdue === 1 ? "task" : "tasks"} · {overdueOnly ? "showing only these — click to show all" : "click to filter"}
          </p>
        </button>
        <div className="bg-white rounded-xl border border-gray-200 px-4 py-3">
          <p className="text-2xl font-semibold text-amber-700">{totals.soon}</p>
          <p className="text-xs text-gray-500">due in the next 7 days</p>
        </div>
      </div>

      {error && <InlineError message={error} onRetry={() => reload()} />}

      <div className="flex items-center gap-3">
        <p className="section-label">Clients</p>
        <span className="ml-auto flex items-center gap-3">
          <button type="button" onClick={() => setExpanded(cards.map((c) => c.clientId))} className="text-xs text-blue-600 hover:underline">Expand all</button>
          <button type="button" onClick={() => setExpanded([])} className="text-xs text-blue-600 hover:underline">Collapse all</button>
        </span>
      </div>

      {cards.length === 0 ? (
        <p className="text-sm text-gray-500 bg-white rounded-xl border border-gray-200 p-6">
          {tasks.length === 0
            ? "No tasks are assigned yet — use the Assign tab to give a client their first task."
            : overdueOnly
              ? "Nothing is overdue. "
              : `No assigned task matches “${search.trim()}”.`}
          {tasks.length > 0 && overdueOnly && (
            <button type="button" onClick={() => setOverdueOnly(false)} className="text-blue-600 hover:underline">Show all clients</button>
          )}
        </p>
      ) : (
        <div className="space-y-3">
          {cards.map((p) => (
            <ClientProgressCard
              key={p.clientId}
              progress={p}
              expanded={expanded.includes(p.clientId)}
              onToggle={() => setExpanded((prev) => (prev.includes(p.clientId) ? prev.filter((c) => c !== p.clientId) : [...prev, p.clientId]))}
              onDueDate={(taskId, due) => patch({ taskId, dueDate: due })}
              onStatus={(taskId, status) => patch({ taskId, status })}
              onRemove={removeTask}
            />
          ))}
        </div>
      )}

      <ConfirmDialog
        open={Boolean(confirm)}
        title={confirm?.title ?? ""}
        body={confirm?.body ?? ""}
        confirmLabel="Remove"
        onConfirm={() => confirm?.run()}
        onCancel={() => setConfirm(null)}
      />
    </div>
  )
}
