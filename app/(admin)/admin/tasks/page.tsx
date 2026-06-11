// app/(admin)/admin/tasks/page.tsx
"use client"

import { useState, useEffect } from "react"
import { groupByStage } from "@/lib/task-stages"
import { RichTextEditor } from "@/components/ui/RichTextEditor"

interface Template {
  id: string
  title: string
  description: string | null
  stage: string | null
  tag: string | null
  notes: string | null
  form_key: string | null
  embed_url: string | null
  stage_order?: number
  sort_order?: number
  created_at: string
}

interface FormSummary { key: string; label: string }

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

interface Attachment {
  id: string
  file_name: string
  size: number | null
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
  const [attachments, setAttachments] = useState<Record<string, Attachment[]>>({})
  const [forms, setForms] = useState<FormSummary[]>([])
  const [uploading, setUploading] = useState(false)
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

  // expanded task (notes editor) state
  const [openTaskId, setOpenTaskId] = useState<string | null>(null)
  const [notesDraft, setNotesDraft] = useState("")
  const [savingNotes, setSavingNotes] = useState(false)
  const [notesSaved, setNotesSaved] = useState(false)

  // new stage state
  const [newStageName, setNewStageName] = useState("")

  const [assignClientId, setAssignClientId] = useState("")
  const [assignTemplateIds, setAssignTemplateIds] = useState<string[]>([])
  const [assignDueDate, setAssignDueDate] = useState("")
  const [clientList, setClientList] = useState<{ id: string; label: string }[]>([])

  async function load() {
    const res = await fetch("/api/admin/tasks")
    if (res.ok) {
      const d = await res.json()
      setTemplates(d.templates ?? [])
      setTasks(d.tasks ?? [])
      setAttachments(d.attachmentsByTemplate ?? {})
    }
    setLoading(false)
  }

  async function uploadFile(templateId: string, file: File) {
    setUploading(true)
    const fd = new FormData()
    fd.append("file", file)
    fd.append("scope", "template")
    fd.append("refId", templateId)
    const res = await fetch("/api/task-files", { method: "POST", body: fd })
    setUploading(false)
    if (res.ok) load()
    else alert("Upload failed (max 25MB).")
  }

  async function deleteFile(id: string) {
    await fetch(`/api/task-files/${id}`, { method: "DELETE" })
    load()
  }

  useEffect(() => {
    load()
    fetch("/api/admin/fileflow-forms")
      .then((r) => r.json())
      .then((d) => setForms(d.forms ?? []))
      .catch(() => {})
    fetch("/api/admin/clients-list")
      .then((r) => r.json())
      .then((d) => setClientList(d.clients ?? []))
      .catch(() => {})
  }, [])

  async function setFormKey(templateId: string, formKey: string) {
    const res = await fetch("/api/admin/tasks", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: templateId, formKey: formKey || "" }),
    })
    if (res.ok) load()
  }

  async function setEmbedUrl(templateId: string, embedUrl: string) {
    const res = await fetch("/api/admin/tasks", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: templateId, embedUrl: embedUrl.trim() }),
    })
    if (res.ok) load()
  }

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

  function toggleOpen(t: Template) {
    if (openTaskId === t.id) { setOpenTaskId(null); return }
    setOpenTaskId(t.id)
    setNotesDraft(t.notes ?? "")
    setNotesSaved(false)
  }

  async function saveNotes(t: Template) {
    setSavingNotes(true)
    const res = await fetch("/api/admin/tasks", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: t.id, title: t.title, tag: t.tag ?? undefined, notes: notesDraft }),
    })
    setSavingNotes(false)
    if (res.ok) { setNotesSaved(true); load(); setTimeout(() => setNotesSaved(false), 2000) }
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
    if (!assignClientId.trim() || assignTemplateIds.length === 0) return
    const res = await fetch("/api/admin/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "assign",
        clientId: assignClientId.trim(),
        templateIds: assignTemplateIds,
        dueDate: assignDueDate || undefined,
      }),
    })
    if (res.ok) { setAssignClientId(""); setAssignTemplateIds([]); setAssignDueDate(""); load() }
  }

  function toggleAssignTemplate(id: string) {
    setAssignTemplateIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])
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
  const clientLabelOf = (id: string) => clientList.find((c) => c.id === id)?.label ?? id
  const taskGroupsByClient = Object.entries(
    tasks.reduce<Record<string, ClientTask[]>>((acc, t) => {
      ;(acc[t.client_id] ??= []).push(t)
      return acc
    }, {})
  ).sort((a, b) => clientLabelOf(a[0]).localeCompare(clientLabelOf(b[0]), undefined, { sensitivity: "base" }))

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

      {/* Assign to client — up top, it's the most-used action */}
      <section className="space-y-4 bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="text-lg font-semibold text-gray-800">Assign Task to Client</h2>
        <form onSubmit={assignTask} className="space-y-4">
          <div className="flex gap-3 flex-wrap items-end">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-500">Client</label>
              <select value={assignClientId} onChange={(e) => setAssignClientId(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 max-w-xs" required>
                <option value="">Select client</option>
                {clientList.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-500">Due Date (optional, applies to all selected tasks)</label>
              <input type="date" value={assignDueDate} onChange={(e) => setAssignDueDate(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <button
              type="submit"
              disabled={!assignClientId || assignTemplateIds.length === 0}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              {assignTemplateIds.length > 1 ? `Assign ${assignTemplateIds.length} Tasks` : "Assign"}
            </button>
            {assignTemplateIds.length > 0 && (
              <button type="button" onClick={() => setAssignTemplateIds([])} className="text-xs text-gray-400 hover:text-gray-600 pb-2.5">
                Clear selection
              </button>
            )}
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500">Tasks (check one or more)</label>
            <div className="border border-gray-300 rounded-lg max-h-56 overflow-y-auto divide-y divide-gray-100">
              {stageGroups.map((g) => (
                <div key={g.stage}>
                  <p className="px-3 py-1.5 bg-gray-50 text-xs font-semibold text-gray-500 sticky top-0">{g.stage}</p>
                  {g.tasks.map((t) => (
                    <label key={t.id} className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-800 cursor-pointer hover:bg-blue-50">
                      <input
                        type="checkbox"
                        checked={assignTemplateIds.includes(t.id)}
                        onChange={() => toggleAssignTemplate(t.id)}
                        className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      {t.title}
                    </label>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </form>
      </section>

      {/* Assigned tasks — up top so current client work is visible at a glance */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-gray-800">Assigned Tasks</h2>
        {tasks.length === 0 ? (
          <p className="text-sm text-gray-400">No tasks assigned yet.</p>
        ) : (
          taskGroupsByClient.map(([clientId, list]) => (
            <div key={clientId} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-4 py-2 bg-gray-50 border-b border-gray-200 text-sm font-semibold text-gray-700">{clientLabelOf(clientId)}</div>
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
                        <span className="flex-1 min-w-0 text-sm text-gray-800">
                          {t.title}
                          {t.notes && <span className="ml-2 text-xs text-gray-400">📝</span>}
                        </span>
                        {t.tag && <TagBadge tag={t.tag} />}
                        <button onClick={() => toggleOpen(t)} className="text-xs text-blue-600 hover:underline">{openTaskId === t.id ? "Close" : "Open"}</button>
                        <button onClick={() => startEdit(t)} className="text-xs text-gray-400 hover:text-blue-600 hover:underline">Edit</button>
                        <button onClick={() => deleteTemplate(t.id)} className="text-xs text-gray-300 hover:text-red-600 transition-colors">Delete</button>
                      </>
                    )}
                  </li>
                ))}
              </ul>
              {/* Expanded task detail (notes) */}
              {group.tasks.some((t) => t.id === openTaskId) && (() => {
                const t = group.tasks.find((x) => x.id === openTaskId)!
                return (
                  <div className="px-4 py-4 bg-gray-50 border-t border-gray-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Notes for: {t.title}</p>
                      {notesSaved && <span className="text-xs text-green-600 font-medium">Saved</span>}
                    </div>
                    <RichTextEditor key={t.id} value={t.notes ?? ""} onChange={setNotesDraft} />
                    <div className="flex items-center gap-3">
                      <button onClick={() => saveNotes(t)} disabled={savingNotes} className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50">
                        {savingNotes ? "Saving…" : "Save notes"}
                      </button>
                      <button onClick={() => setOpenTaskId(null)} className="text-sm text-gray-400 hover:underline">Close</button>
                    </div>

                    <div className="pt-2 border-t border-gray-200 space-y-2">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Linked intake form</p>
                      <div className="flex items-center gap-2 flex-wrap">
                        <select
                          value={t.form_key ?? ""}
                          onChange={(e) => setFormKey(t.id, e.target.value)}
                          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="">No form</option>
                          {forms.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
                        </select>
                        <span className="text-xs text-gray-400">
                          {t.form_key ? "Clients fill this form from the task." : "Pick a FileFlow form to attach."}
                        </span>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-gray-200 space-y-2">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Embedded form (Airtable form or any URL)</p>
                      <div className="flex items-center gap-2 flex-wrap">
                        <input
                          defaultValue={t.embed_url ?? ""}
                          onBlur={(e) => { if (e.target.value.trim() !== (t.embed_url ?? "")) setEmbedUrl(t.id, e.target.value) }}
                          placeholder="https://airtable.com/…/form — shows inside the task"
                          className="flex-1 min-w-[18rem] px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <span className="text-xs text-gray-400">{t.embed_url ? "Embedded in the task for clients. Clear to remove." : "Saves when you click away."}</span>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-gray-200 space-y-2">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Files (shown to clients with this task)</p>
                      {(attachments[t.id] ?? []).length > 0 ? (
                        <ul className="space-y-1">
                          {(attachments[t.id] ?? []).map((f) => (
                            <li key={f.id} className="flex items-center gap-3 text-sm">
                              <a href={`/api/task-files/${f.id}`} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline truncate max-w-xs">{f.file_name}</a>
                              <button onClick={() => deleteFile(f.id)} className="text-xs text-gray-300 hover:text-red-600">Remove</button>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-xs text-gray-400">No files yet.</p>
                      )}
                      <label className="inline-flex items-center gap-2 text-sm text-blue-600 cursor-pointer hover:underline">
                        {uploading ? "Uploading…" : "+ Upload PDF / document"}
                        <input
                          type="file"
                          className="hidden"
                          disabled={uploading}
                          onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadFile(t.id, f); e.target.value = "" }}
                        />
                      </label>
                    </div>
                  </div>
                )
              })()}
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


    </div>
  )
}
