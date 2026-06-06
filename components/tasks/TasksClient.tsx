// components/tasks/TasksClient.tsx
"use client"

import { useState, useEffect } from "react"
import { groupByStage } from "@/lib/task-stages"
import { RichTextView } from "@/components/ui/RichTextEditor"

interface Task {
  id: string
  title: string
  description: string | null
  status: "pending" | "done"
  due_date: string | null
  stage: string | null
  tag: string | null
  notes: string | null
  stage_order?: number
  sort_order?: number
  created_at: string
}

function TagBadge({ tag }: { tag: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-xs text-gray-500 whitespace-nowrap">
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 4H7a2 2 0 01-2-2V6a2 2 0 012-2h6l4 4v10a2 2 0 01-2 2z" />
      </svg>
      {tag}
    </span>
  )
}

export default function TasksClient() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [openId, setOpenId] = useState<string | null>(null)

  useEffect(() => {
    fetch("/api/tasks")
      .then((r) => r.json())
      .then((d) => { setTasks(d.tasks ?? []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  async function toggleStatus(task: Task) {
    const newStatus = task.status === "pending" ? "done" : "pending"
    setTasks((prev) => prev.map((t) => t.id === task.id ? { ...t, status: newStatus } : t))
    const res = await fetch("/api/tasks", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: task.id, status: newStatus }),
    })
    if (!res.ok) {
      setTasks((prev) => prev.map((t) => t.id === task.id ? { ...t, status: task.status } : t))
    }
  }

  if (loading) return <p className="text-gray-400 text-sm">Loading...</p>

  if (tasks.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 bg-gray-50 rounded-lg border border-gray-200">
        <p className="text-sm text-gray-400">No tasks assigned yet.</p>
      </div>
    )
  }

  const groups = groupByStage(tasks)

  return (
    <div className="space-y-5">
      {groups.map((group) => {
        const done = group.tasks.filter((t) => t.status === "done").length
        return (
          <div key={group.stage} className="rounded-xl border border-gray-200 overflow-hidden bg-white">
            <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50 border-b border-gray-200">
              <h3 className="text-sm font-semibold text-gray-800">{group.stage}</h3>
              <span className="text-xs text-gray-400 font-medium">{done}/{group.tasks.length}</span>
            </div>
            <ul className="divide-y divide-gray-100">
              {group.tasks.map((task) => (
                <li key={task.id} className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => toggleStatus(task)}
                      className={`w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-colors ${
                        task.status === "done"
                          ? "bg-green-600 border-green-600 text-white"
                          : "border-gray-300 hover:border-green-400"
                      }`}
                      aria-label={task.status === "done" ? "Mark not done" : "Mark done"}
                    >
                      {task.status === "done" && (
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm ${task.status === "done" ? "line-through text-gray-400" : "text-gray-800"}`}>
                        {task.title}
                      </p>
                      {task.due_date && (
                        <p className="text-xs text-gray-400 mt-0.5">Due: {new Date(task.due_date).toLocaleDateString()}</p>
                      )}
                    </div>
                    {task.tag && <TagBadge tag={task.tag} />}
                    {task.notes && (
                      <button
                        onClick={() => setOpenId(openId === task.id ? null : task.id)}
                        className="text-xs text-blue-600 hover:underline flex-shrink-0"
                      >
                        {openId === task.id ? "Hide details" : "Details"}
                      </button>
                    )}
                  </div>
                  {task.notes && openId === task.id && (
                    <div className="mt-3 ml-8 rounded-lg bg-gray-50 border border-gray-200 p-3">
                      <RichTextView html={task.notes} />
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )
      })}
    </div>
  )
}
