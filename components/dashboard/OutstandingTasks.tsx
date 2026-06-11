// components/dashboard/OutstandingTasks.tsx — dashboard card of pending tasks,
// checkable in place (same PATCH as the Tasks page).
"use client"

import Link from "next/link"
import { useState } from "react"

interface DashTask {
  id: string
  title: string
  due_date: string | null
}

export default function OutstandingTasks({ initialTasks }: { initialTasks: DashTask[] }) {
  const [tasks] = useState(initialTasks)
  const [doneIds, setDoneIds] = useState<Set<string>>(new Set())

  const today = new Date(new Date().toLocaleDateString("en-US", { timeZone: "America/New_York" }))
  const fmtDue = (d: string) => new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
  const openCount = tasks.filter((t) => !doneIds.has(t.id)).length

  async function toggle(task: DashTask) {
    const wasDone = doneIds.has(task.id)
    const newStatus = wasDone ? "pending" : "done"
    setDoneIds((prev) => {
      const next = new Set(prev)
      if (wasDone) next.delete(task.id)
      else next.add(task.id)
      return next
    })
    const res = await fetch("/api/tasks", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: task.id, status: newStatus }),
    })
    if (!res.ok) {
      setDoneIds((prev) => {
        const next = new Set(prev)
        if (wasDone) next.add(task.id)
        else next.delete(task.id)
        return next
      })
    }
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 keep-ink">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
        <h2 className="text-sm font-semibold text-gray-800">
          Outstanding Tasks
          {openCount > 0 && (
            <span className="ml-2 inline-flex items-center justify-center min-w-[1.5rem] px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 text-xs font-bold">{openCount}</span>
          )}
        </h2>
        <Link href="/tasks" className="text-xs text-blue-600 hover:underline">View all tasks →</Link>
      </div>
      {tasks.length === 0 ? (
        <p className="px-4 py-4 text-sm text-gray-400">You're all caught up — no outstanding tasks. 🎉</p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {tasks.slice(0, 6).map((t) => {
            const done = doneIds.has(t.id)
            const overdue = !done && t.due_date ? new Date(t.due_date) < today : false
            return (
              <li key={t.id} className="flex items-center gap-3 px-4 py-2.5">
                <button
                  onClick={() => toggle(t)}
                  className={`w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-colors ${
                    done ? "bg-green-600 border-green-600 text-white" : "border-gray-300 hover:border-green-400"
                  }`}
                  aria-label={done ? "Mark not done" : "Mark done"}
                >
                  {done && (
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
                <Link href="/tasks" className={`flex-1 text-sm min-w-0 truncate ${done ? "line-through text-gray-400" : "text-gray-800 hover:text-blue-700"}`}>
                  {t.title}
                </Link>
                <span className={`text-xs whitespace-nowrap ${overdue ? "text-red-600 font-semibold" : "text-gray-400"}`}>
                  {done ? "Done ✓" : t.due_date ? `${overdue ? "Overdue — was due " : "Due "}${fmtDue(t.due_date)}` : "No due date"}
                </span>
              </li>
            )
          })}
          {tasks.length > 6 && (
            <li className="px-4 py-2.5">
              <Link href="/tasks" className="text-xs text-blue-600 hover:underline">+ {tasks.length - 6} more on your Tasks page</Link>
            </li>
          )}
        </ul>
      )}
    </div>
  )
}
