// app/(admin)/admin/tasks/page.tsx
"use client"

import { useState, useEffect } from "react"
import { groupByStage } from "@/lib/task-stages"

interface Template {
  id: string
  title: string
  description: string | null
  stage: string | null
  tag: string | null
  stage_order?: number
  sort_order?: number
  created_at: string
}

interface ClientTask {
  id: string
  client_id: string
  title: string
  description: string | null
  status: "pending" | "done"
  due_date: string | null
  stage: string | null
  tag: string | null
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

export default function AdminTasksPage() {
  const [templates, setTemplates] = useState<Template[]>([])
  const [tasks, setTasks] = useState<ClientTask[]>([])
  const [loading, setLoading] = useState(true)

  // inline add-task state, keyed by stage
  const [addingStage, setAddingStage] = useState<string | null>(null)
  const [addTitle, setAddTitle] = useState("")
  const [addTag, setAddTag] = useState("")

  // inline edit-task state
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState("")
  const [editTag, setEditTag] = useState("")

  // inline rename-stage state
  const [editingStage, setEditingStage] = useState<string | null>(null)
  const [stageDraft, setStageDraft] = useState("")

  // new stage state
  const [newStageName, setNewStageName] = useState("")

  const [assignClientId, setAssignClientId] = useState("")
  const [assignTemplateId, setAssignTemplateId] = useState("")
  const [assignDueDate, setAssignDueDate] = useState("")

  async function load() {
    const res = await fetch("/api/admin/tasks")
    if (res.ok) {
      const d = await res.json()
      setTemplates(d.templates ?? [])
      setTasks(d.tasks ?? [])
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function addTask(stage: string, e: React.FormEvent) {
    e.preventDefault()
    if (!addTitle.trim()) return
    const res = await fetch("/api/admin/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "create_template", title: addTitle, stage, tag: addTag || undefined }),
    })
    if (res.ok) { setAddTitle(""); setAddTag(""); setAddingStage(null); load() }
  }

  async function addStage(e: React.FormEvent) {
    e.preventDefault()
    const name = newStageName.trim()
    if (!name) return
    const res = await fetch("/api/admin/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "create_template", title: "New task", stage: name }),
    })
    if (res.ok) { setNewStageName(""); load() }
  }

  function startEdit(t: Template) {
    setEditingTaskId(t.id)
    setEditTitle(t.title)
    setEditTag(t.tag ?? "")
  }

  async function saveTaskEdit(id: string) {
    if (!editTitle.trim()) return
    const res = await fetch("/api/admin/tasks", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, title: editTitle, tag: editTag || undefined }),
    })
    if (res.ok) { setEditingTaskId(null); load() }
  }

  async function saveStageRename(oldStage: string) {
    const to = stageDraft.trim()
    if (!to || to === oldStage) { setEditingStage(null); return }
    const res = await fetch("/api/admin/tasks", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ oldStage, newStage: to }),
    })
    if (res.ok) { setEditingStage(null); load() }
  }

  async function deleteTemplate(id: string) {
    await fetch("/api/admin/tasks", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, type: "template" }),
    })
    load()
  }

  async function assignTask(e: React.FormEvent) {
    e.preventDefault()
    if (!assignClientId.trim() || !assignTemplateId) return
    const res = await fetch("/api/admin/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "assign",
        clientId: assignClientId.trim(),
        templateId: assignTemplateId,
        dueDate: assignDueDate || undefined,
      }),
    })
    if (res.ok) { setAssignClientId(""); setAssignTemplateId(""); setAssignDueDate(""); load() }
  }

  async function deleteTask(id: string) {
    await fetch("/api/admin/tasks", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, type: "task" }),
    })
    load()
  }

  if (loading) return <p className="text-gray-400 text-sm">Loading...</p>

  const stageGroups = groupByStage(templates)
  const taskGroupsByClient = Object.entries(
    tasks.reduce<Record<string, ClientTask[]>>((acc, t) => {
      ;(acc[t.client_id] ??= []).push(t)
      return acc
    }, {})
  )

  return (
    <div className="space-y-10">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-2xl font-bold text-gray-900">Tasks</h1>
        <form onSubmit={addStage} className="flex items-center gap-2">
          <input
            value={newStageName}
            onChange={(e) => setNewStageName(e.target.value)}
            placeholder="New stage name"
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button type="submit" className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700">+ Add Stage</button>
        </form>
      </div>

      {/* Task board (templates grouped by stage) */}
      <section className="space-y-4">
        {stageGroups.length === 0 ? (
          <p className="text-sm text-gray-400">No tasks yet.</p>
        ) : (
          stageGroups.map((group) => (
            <div key={group.stage} className="rounded-xl border border-gray-200 overflow-hidden bg-white">
              <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50 border-b border-gray-200 gap-3">
                {editingStage === group.stage ? (
                  <div className="flex items-center gap-2 flex-1">
                    <input
                      autoFocus
                      value={stageDraft}
                      onChange={(e) => setStageDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") saveStageRename(group.stage)
                        if (e.key === "Escape") setEditingStage(null)
                      }}
                      className="text-sm font-semibold text-gray-800 border border-gray-300 rounded px-2 py-1 flex-1 max-w-xs"
                    />
                    <button onClick={() => saveStageRename(group.stage)} className="text-xs text-blue-600 hover:underline">Save</button>
                    <button onClick={() => setEditingStage(null)} className="text-xs text-gray-400 hover:underline">Cancel</button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-semibold text-gray-800">{group.stage}</h2>
                    <button
                      onClick={() => { setEditingStage(group.stage); setStageDraft(group.stage) }}
                      className="text-xs text-gray-400 hover:text-blue-600 hover:underline"
                    >
                      Rename
                    </button>
                  </div>
                )}
                <span className="text-xs text-gray-400 font-medium flex-shrink-0">{group.tasks.length} tasks</span>
              </div>
              <ul className="divide-y divide-gray-100">
                {group.tasks.map((t) => (
                  <li key={t.id} className="flex items-center gap-3 px-4 py-3">
                    {editingTaskId === t.id ? (
                      <div className="flex items-center gap-2 flex-1 flex-wrap">
                        <input
                          autoFocus
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") saveTaskEdit(t.id)
                            if (e.key === "Escape") setEditingTaskId(null)
                          }}
                          className="flex-1 min-w-48 text-sm text-gray-800 border border-gray-300 rounded px-2 py-1"
                        />
                        <select
                          value={editTag}
                          onChange={(e) => setEditTag(e.target.value)}
                          className="px-2 py-1 border border-gray-300 rounded text-sm"
                        >
                          <option value="">No tag</option>
                          <option value="Form">Form</option>
                          <option value="Signature">Signature</option>
                        </select>
                        <button onClick={() => saveTaskEdit(t.id)} className="text-xs text-blue-600 hover:underline">Save</button>
                        <button onClick={() => setEditingTaskId(null)} className="text-xs text-gray-400 hover:underline">Cancel</button>
                      </div>
                    ) : (
                      <>
                        <span className="w-1.5 h-1.5 rounded-full bg-gray-300 flex-shrink-0" />
                        <span className="flex-1 min-w-0 text-sm text-gray-800">{t.title}</span>
                        {t.tag && <TagBadge tag={t.tag} />}
                        <button onClick={() => startEdit(t)} className="text-xs text-gray-400 hover:text-blue-600 hover:underline">Edit</button>
                        <button onClick={() => deleteTemplate(t.id)} className="text-xs text-gray-300 hover:text-red-600 transition-colors">Delete</button>
                      </>
                    )}
                  </li>
                ))}
              </ul>
              <div className="px-4 py-2.5 bg-gray-50 border-t border-gray-100">
                {addingStage === group.stage ? (
                  <form onSubmit={(e) => addTask(group.stage, e)} className="flex items-center gap-2 flex-wrap">
                    <input
                      autoFocus
                      value={addTitle}
                      onChange={(e) => setAddTitle(e.target.value)}
                      placeholder="Task name"
                      className="flex-1 min-w-48 px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <select
                      value={addTag}
                      onChange={(e) => setAddTag(e.target.value)}
                      className="px-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">No tag</option>
                      <option value="Form">Form</option>
                      <option value="Signature">Signature</option>
                    </select>
                    <button type="submit" className="px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700">Add</button>
                    <button type="button" onClick={() => { setAddingStage(null); setAddTitle(""); setAddTag("") }} className="text-xs text-gray-400 hover:underline">Cancel</button>
                  </form>
                ) : (
                  <button
                    onClick={() => { setAddingStage(group.stage); setAddTitle(""); setAddTag("") }}
                    className="text-sm text-blue-600 hover:underline"
                  >
                    + Add Task
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </section>

      {/* Assign to client */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-gray-800">Assign Task to Client</h2>
        <form onSubmit={assignTask} className="flex gap-3 flex-wrap items-end">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500">Client ID</label>
            <input value={assignClientId} onChange={(e) => setAssignClientId(e.target.value)} placeholder="client id" className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" required />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500">Task</label>
            <select value={assignTemplateId} onChange={(e) => setAssignTemplateId(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 max-w-xs" required>
              <option value="">Select task</option>
              {stageGroups.map((g) => (
                <optgroup key={g.stage} label={g.stage}>
                  {g.tasks.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
                </optgroup>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500">Due Date (optional)</label>
            <input type="date" value={assignDueDate} onChange={(e) => setAssignDueDate(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <button type="submit" className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700">Assign</button>
        </form>
      </section>

      {/* Assigned tasks */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-gray-800">Assigned Tasks</h2>
        {tasks.length === 0 ? (
          <p className="text-sm text-gray-400">No tasks assigned yet.</p>
        ) : (
          taskGroupsByClient.map(([clientId, list]) => (
            <div key={clientId} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-4 py-2 bg-gray-50 border-b border-gray-200 text-xs font-medium text-gray-500">Client: {clientId}</div>
              <ul className="divide-y divide-gray-100">
                {list.map((t) => (
                  <li key={t.id} className="flex items-center justify-between px-4 py-3 gap-3">
                    <div className="min-w-0">
                      <p className="text-sm text-gray-800">{t.title}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {t.stage ?? "—"}{t.due_date ? ` · Due ${new Date(t.due_date).toLocaleDateString()}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${t.status === "done" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}>{t.status}</span>
                      <button onClick={() => deleteTask(t.id)} className="text-xs text-red-500 hover:text-red-700">Remove</button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}
      </section>
    </div>
  )
}
