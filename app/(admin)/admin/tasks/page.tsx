// app/(admin)/admin/tasks/page.tsx
"use client"

import { useState, useEffect } from "react"

interface Template {
  id: string
  title: string
  description: string | null
  created_at: string
}

interface ClientTask {
  id: string
  client_id: string
  title: string
  description: string | null
  status: "pending" | "done"
  due_date: string | null
  created_at: string
}

export default function AdminTasksPage() {
  const [templates, setTemplates] = useState<Template[]>([])
  const [tasks, setTasks] = useState<ClientTask[]>([])
  const [loading, setLoading] = useState(true)
  const [newTitle, setNewTitle] = useState("")
  const [newDesc, setNewDesc] = useState("")
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

  async function createTemplate(e: React.FormEvent) {
    e.preventDefault()
    if (!newTitle.trim()) return
    const res = await fetch("/api/admin/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "create_template", title: newTitle, description: newDesc }),
    })
    if (res.ok) { setNewTitle(""); setNewDesc(""); load() }
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

  async function deleteTemplate(id: string) {
    await fetch("/api/admin/tasks", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, type: "template" }),
    })
    load()
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

  return (
    <div className="space-y-10">
      <h1 className="text-2xl font-bold text-gray-900">Tasks</h1>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-gray-800">Task Templates</h2>
        <form onSubmit={createTemplate} className="flex gap-3 flex-wrap">
          <input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Task title" className="flex-1 min-w-48 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" required />
          <input value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder="Description (optional)" className="flex-1 min-w-48 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <button type="submit" className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700">Add Template</button>
        </form>
        {templates.length === 0 ? (
          <p className="text-sm text-gray-400">No templates yet.</p>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
            {templates.map((t) => (
              <div key={t.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-gray-900">{t.title}</p>
                  {t.description && <p className="text-xs text-gray-500 mt-0.5">{t.description}</p>}
                </div>
                <button onClick={() => deleteTemplate(t.id)} className="text-xs text-red-500 hover:text-red-700 ml-4">Delete</button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-gray-800">Assign Task to Client</h2>
        <form onSubmit={assignTask} className="flex gap-3 flex-wrap items-end">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500">Client ID</label>
            <input value={assignClientId} onChange={(e) => setAssignClientId(e.target.value)} placeholder="e.g. smith-jane" className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" required />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500">Template</label>
            <select value={assignTemplateId} onChange={(e) => setAssignTemplateId(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" required>
              <option value="">Select template</option>
              {templates.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500">Due Date (optional)</label>
            <input type="date" value={assignDueDate} onChange={(e) => setAssignDueDate(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <button type="submit" className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700">Assign</button>
        </form>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-gray-800">Assigned Tasks</h2>
        {tasks.length === 0 ? (
          <p className="text-sm text-gray-400">No tasks assigned yet.</p>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
            {tasks.map((t) => (
              <div key={t.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-xs text-gray-400 mb-0.5">Client: {t.client_id}</p>
                  <p className="text-sm font-medium text-gray-900">{t.title}</p>
                  {t.description && <p className="text-xs text-gray-500 mt-0.5">{t.description}</p>}
                  {t.due_date && <p className="text-xs text-gray-400 mt-0.5">Due: {new Date(t.due_date).toLocaleDateString()}</p>}
                </div>
                <div className="flex items-center gap-3 ml-4">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${t.status === "done" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}>{t.status}</span>
                  <button onClick={() => deleteTask(t.id)} className="text-xs text-red-500 hover:text-red-700">Remove</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
