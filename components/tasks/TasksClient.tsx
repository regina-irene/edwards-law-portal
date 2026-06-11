// components/tasks/TasksClient.tsx
"use client"

import { useState, useEffect } from "react"
import { groupByStage } from "@/lib/task-stages"
import { RichTextView } from "@/components/ui/RichTextEditor"
import FormFill from "@/components/tasks/FormFill"
import AirtableEmbed from "@/components/ui/AirtableEmbed"

interface Attachment {
  id: string
  file_name: string
  size: number | null
}

interface Task {
  id: string
  title: string
  description: string | null
  status: "pending" | "done"
  due_date: string | null
  stage: string | null
  tag: string | null
  notes: string | null
  form_key: string | null
  embed_url: string | null
  firmFiles?: Attachment[]
  myFiles?: Attachment[]
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
  const [uploadingId, setUploadingId] = useState<string | null>(null)

  function reload() {
    return fetch("/api/tasks")
      .then((r) => r.json())
      .then((d) => setTasks(d.tasks ?? []))
      .catch(() => {})
  }

  useEffect(() => {
    reload().finally(() => setLoading(false))
  }, [])

  async function uploadMyFile(taskId: string, file: File) {
    setUploadingId(taskId)
    const fd = new FormData()
    fd.append("file", file)
    fd.append("scope", "client_task")
    fd.append("refId", taskId)
    const res = await fetch("/api/task-files", { method: "POST", body: fd })
    setUploadingId(null)
    if (res.ok) reload()
    else alert("Upload failed (max 25MB).")
  }

  async function deleteMyFile(id: string) {
    await fetch(`/api/task-files/${id}`, { method: "DELETE" })
    reload()
  }

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
  const open = tasks.filter((t) => t.status === "pending")
  const doneCount = tasks.length - open.length
  const today = new Date(new Date().toLocaleDateString("en-US", { timeZone: "America/New_York" }))
  const deadlines = open
    .filter((t) => t.due_date)
    .sort((a, b) => new Date(a.due_date!).getTime() - new Date(b.due_date!).getTime())
  const fmtDue = (d: string) => new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })

  return (
    <div className="space-y-5">
      {/* At-a-glance: open tasks + deadlines */}
      <div className="rounded-xl border border-blue-200 bg-blue-50 keep-ink p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <div>
            <p className="text-2xl font-bold text-blue-900">{open.length}</p>
            <p className="text-xs font-medium text-blue-700">Open task{open.length === 1 ? "" : "s"}</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-green-700">{doneCount}</p>
            <p className="text-xs font-medium text-green-700">Completed</p>
          </div>
          <div className="flex-1 min-w-[14rem]">
            <p className="text-xs font-semibold text-blue-900 mb-1">Upcoming deadlines</p>
            {deadlines.length === 0 ? (
              <p className="text-xs text-blue-700/70">No deadlines right now.</p>
            ) : (
              <ul className="space-y-0.5">
                {deadlines.slice(0, 4).map((t) => {
                  const overdue = new Date(t.due_date!) < today
                  return (
                    <li key={t.id} className="flex items-baseline gap-2 text-xs">
                      <span className={`whitespace-nowrap font-semibold ${overdue ? "text-red-600" : "text-blue-900"}`}>
                        {overdue ? "Overdue · " : ""}{fmtDue(t.due_date!)}
                      </span>
                      <span className="text-gray-700 truncate">{t.title}</span>
                    </li>
                  )
                })}
                {deadlines.length > 4 && <li className="text-xs text-blue-700/70">+ {deadlines.length - 4} more below</li>}
              </ul>
            )}
          </div>
        </div>
      </div>

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
                    <button
                      onClick={() => setOpenId(openId === task.id ? null : task.id)}
                      className="text-xs text-blue-600 hover:underline flex-shrink-0"
                    >
                      {openId === task.id ? "Hide details" : "Details"}
                    </button>
                  </div>
                  {openId === task.id && (
                    <div className="mt-3 ml-8 rounded-lg bg-gray-50 border border-gray-200 p-3 space-y-3">
                      {task.notes && <RichTextView html={task.notes} />}

                      {task.form_key && (
                        <div className="rounded-lg bg-white border border-gray-200 p-3">
                          <FormFill formKey={task.form_key} />
                        </div>
                      )}

                      {task.embed_url && (
                        <div className="rounded-lg bg-white border border-gray-200 p-3">
                          <AirtableEmbed url={task.embed_url} title={task.title} height={650} />
                        </div>
                      )}

                      {(task.firmFiles ?? []).length > 0 && (
                        <div>
                          <p className="text-xs font-semibold text-gray-500 mb-1">From the firm</p>
                          <ul className="space-y-1">
                            {(task.firmFiles ?? []).map((f) => (
                              <li key={f.id}>
                                <a href={`/api/task-files/${f.id}`} target="_blank" rel="noreferrer" className="text-sm text-blue-600 hover:underline">📎 {f.file_name}</a>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      <div>
                        <p className="text-xs font-semibold text-gray-500 mb-1">Your uploads</p>
                        {(task.myFiles ?? []).length > 0 ? (
                          <ul className="space-y-1 mb-1">
                            {(task.myFiles ?? []).map((f) => (
                              <li key={f.id} className="flex items-center gap-3">
                                <a href={`/api/task-files/${f.id}`} target="_blank" rel="noreferrer" className="text-sm text-blue-600 hover:underline">📎 {f.file_name}</a>
                                <button onClick={() => deleteMyFile(f.id)} className="text-xs text-gray-300 hover:text-red-600">Remove</button>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-xs text-gray-400 mb-1">No files uploaded yet.</p>
                        )}
                        <label className="inline-flex items-center gap-2 text-sm text-blue-600 cursor-pointer hover:underline">
                          {uploadingId === task.id ? "Uploading…" : "+ Upload a file"}
                          <input
                            type="file"
                            className="hidden"
                            disabled={uploadingId === task.id}
                            onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadMyFile(task.id, f); e.target.value = "" }}
                          />
                        </label>
                      </div>
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
