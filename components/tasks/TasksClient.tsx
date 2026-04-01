// components/tasks/TasksClient.tsx
"use client"

import { useState, useEffect } from "react"

interface Task {
  id: string
  title: string
  description: string | null
  status: "pending" | "done"
  due_date: string | null
  created_at: string
}

export default function TasksClient() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/tasks")
      .then((r) => r.json())
      .then((d) => { setTasks(d.tasks ?? []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  async function toggleStatus(task: Task) {
    const newStatus = task.status === "pending" ? "done" : "pending"
    const res = await fetch("/api/tasks", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: task.id, status: newStatus }),
    })
    if (res.ok) {
      setTasks((prev) => prev.map((t) => t.id === task.id ? { ...t, status: newStatus } : t))
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

  return (
    <div className="space-y-3">
      {tasks.map((task) => (
        <div
          key={task.id}
          className={`flex items-start gap-4 p-4 rounded-lg border ${
            task.status === "done"
              ? "bg-green-50 border-green-200"
              : "bg-white border-gray-200"
          }`}
        >
          <button
            onClick={() => toggleStatus(task)}
            className={`mt-0.5 w-5 h-5 rounded border-2 flex-shrink-0 flex items-center justify-center transition-colors ${
              task.status === "done"
                ? "bg-green-600 border-green-600 text-white"
                : "border-gray-300 hover:border-green-400"
            }`}
            aria-label={task.status === "done" ? "Mark pending" : "Mark done"}
          >
            {task.status === "done" && (
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            )}
          </button>
          <div className="flex-1 min-w-0">
            <p className={`text-sm font-medium ${task.status === "done" ? "line-through text-gray-400" : "text-gray-900"}`}>
              {task.title}
            </p>
            {task.description && (
              <p className="mt-0.5 text-sm text-gray-500">{task.description}</p>
            )}
            {task.due_date && (
              <p className="mt-1 text-xs text-gray-400">
                Due: {new Date(task.due_date).toLocaleDateString()}
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
