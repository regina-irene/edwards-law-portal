"use client"
// components/admin/tasks/TemplatesTab.tsx — the task board: one collapsible
// panel per stage. Panels start closed (the page used to be ~2,500px of
// permanently-open lists) and remember what you had open.
import { useEffect, useState } from "react"
import { RichTextEditor } from "@/components/ui/RichTextEditor"
import { groupByStage } from "@/lib/task-stages"
import { stageAccent, matchesSearch } from "@/lib/task-progress"
import { IconButton, TagBadge, NotesBadge, ConfirmDialog, InlineError } from "./bits"
import type { Template, Attachment, FormSummary } from "./types"

const OPEN_STAGES_KEY = "efl.admin.tasks.openStages"

export default function TemplatesTab({
  templates,
  attachments,
  forms,
  search,
  reload,
}: {
  templates: Template[]
  attachments: Record<string, Attachment[]>
  forms: FormSummary[]
  search: string
  reload: () => Promise<void> | void
}) {
  const [openStages, setOpenStages] = useState<string[]>([])
  const [hydrated, setHydrated] = useState(false)

  const [addingStage, setAddingStage] = useState<string | null>(null)
  const [addTitle, setAddTitle] = useState("")
  const [addTag, setAddTag] = useState("")

  const [editingTaskId, setEditingTaskId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState("")
  const [editTag, setEditTag] = useState("")

  const [editingStage, setEditingStage] = useState<string | null>(null)
  const [stageDraft, setStageDraft] = useState("")

  // Which row's "move or copy to another stage" control is open, and where it
  // is pointed.
  const [movingId, setMovingId] = useState<string | null>(null)
  const [moveTarget, setMoveTarget] = useState("")
  const [moveBusy, setMoveBusy] = useState(false)

  const [openTaskId, setOpenTaskId] = useState<string | null>(null)
  const [notesDraft, setNotesDraft] = useState("")
  const [savingNotes, setSavingNotes] = useState(false)
  const [notesSaved, setNotesSaved] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<{ title: string; body: string; run: () => void } | null>(null)

  const groups = groupByStage(templates)
  const searching = Boolean(search.trim())
  const visibleGroups = groups
    .map((g) => ({ ...g, tasks: g.tasks.filter((t) => matchesSearch(search, t.title, t.tag, t.stage)) }))
    .filter((g) => !searching || g.tasks.length > 0)

  // Restore what was open last time.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(OPEN_STAGES_KEY)
      if (raw) setOpenStages(JSON.parse(raw) as string[])
    } catch { /* a blocked or corrupt localStorage just means everything starts closed */ }
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (!hydrated) return
    try { window.localStorage.setItem(OPEN_STAGES_KEY, JSON.stringify(openStages)) } catch { /* not worth surfacing */ }
  }, [openStages, hydrated])

  // A search should show its matches without making you open every stage.
  const isOpen = (stage: string) => searching || openStages.includes(stage)
  const toggleStage = (stage: string) =>
    setOpenStages((prev) => (prev.includes(stage) ? prev.filter((s) => s !== stage) : [...prev, stage]))

  async function post(body: Record<string, unknown>, method: "POST" | "PATCH" | "DELETE" = "POST") {
    setError(null)
    const res = await fetch("/api/admin/tasks", {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).catch(() => null)
    if (!res?.ok) {
      setError("That didn't save.")
      return false
    }
    await reload()
    return true
  }

  async function addTask(stage: string, e: React.FormEvent) {
    e.preventDefault()
    if (!addTitle.trim()) return
    const ok = await post({ action: "create_template", title: addTitle, stage, tag: addTag || undefined })
    if (ok) { setAddTitle(""); setAddTag(""); setAddingStage(null) }
  }

  async function saveTaskEdit(id: string) {
    if (!editTitle.trim()) return
    if (await post({ id, title: editTitle, tag: editTag || undefined }, "PATCH")) setEditingTaskId(null)
  }

  // Move keeps one copy and re-files it; copy leaves the original where it is.
  // Either way the task carries its tag, notes and linked form.
  async function moveOrCopy(templateId: string, toStage: string, copy: boolean) {
    if (!toStage) return
    setMoveBusy(true)
    const ok = copy
      ? await post({ action: "copy_template", templateId, stage: toStage })
      : await post({ id: templateId, moveToStage: toStage }, "PATCH")
    setMoveBusy(false)
    if (ok) {
      setMovingId(null)
      setMoveTarget("")
      // Open the destination so the task is visible where it landed.
      setOpenStages((prev) => (prev.includes(toStage) ? prev : [...prev, toStage]))
    }
  }

  async function saveStageRename(oldStage: string) {
    const to = stageDraft.trim()
    if (!to || to === oldStage) { setEditingStage(null); return }
    if (await post({ oldStage, newStage: to }, "PATCH")) {
      setOpenStages((prev) => prev.map((s) => (s === oldStage ? to : s)))
      setEditingStage(null)
    }
  }

  async function saveNotes(t: Template) {
    setSavingNotes(true)
    const ok = await post({ id: t.id, title: t.title, tag: t.tag ?? undefined, notes: notesDraft }, "PATCH")
    setSavingNotes(false)
    if (ok) { setNotesSaved(true); setTimeout(() => setNotesSaved(false), 2000) }
  }

  function confirmDeleteTask(t: Template) {
    setConfirm({
      title: `Delete “${t.title}”?`,
      body: "This removes the task from the board. Tasks already assigned to clients stay where they are.",
      run: async () => { setConfirm(null); await post({ id: t.id, type: "template" }, "DELETE") },
    })
  }

  function confirmDeleteStage(stage: string, count: number) {
    setConfirm({
      title: `Delete the “${stage}” stage?`,
      body: count > 0
        ? `${count} ${count === 1 ? "task goes" : "tasks go"} with it: ${groups.find((g) => g.stage === stage)?.tasks.map((t) => t.title).slice(0, 4).join(", ")}${count > 4 ? "…" : ""}. This can't be undone.`
        : "The stage is empty, so nothing else is affected.",
      run: async () => {
        setConfirm(null)
        const list = groups.find((g) => g.stage === stage)?.tasks ?? []
        for (const t of list) {
          await fetch("/api/admin/tasks", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: t.id, type: "template" }),
          }).catch(() => null)
        }
        setOpenStages((prev) => prev.filter((s) => s !== stage))
        await reload()
      },
    })
  }

  async function uploadFile(templateId: string, file: File) {
    setUploading(true)
    const fd = new FormData()
    fd.append("file", file)
    fd.append("scope", "template")
    fd.append("refId", templateId)
    const res = await fetch("/api/task-files", { method: "POST", body: fd }).catch(() => null)
    setUploading(false)
    if (res?.ok) await reload()
    else setError("Upload failed (25 MB max).")
  }

  async function deleteFile(id: string) {
    await fetch(`/api/task-files/${id}`, { method: "DELETE" }).catch(() => null)
    await reload()
  }

  async function setFormKey(templateId: string, formKey: string) {
    await post({ id: templateId, formKey: formKey || "" }, "PATCH")
  }

  async function setEmbedUrl(templateId: string, embedUrl: string) {
    await post({ id: templateId, embedUrl: embedUrl.trim() }, "PATCH")
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <p className="section-label">Task board</p>
        <span className="text-xs text-gray-400">{templates.length} tasks across {groups.length} stages</span>
        <span className="ml-auto flex items-center gap-3">
          <button type="button" onClick={() => setOpenStages(groups.map((g) => g.stage))} className="text-xs text-blue-600 hover:underline">
            Expand all
          </button>
          <button type="button" onClick={() => setOpenStages([])} className="text-xs text-blue-600 hover:underline">
            Collapse all
          </button>
        </span>
      </div>

      {error && <InlineError message={error} onRetry={() => reload()} />}

      {groups.length === 0 && (
        <p className="text-sm text-gray-500 bg-white rounded-xl border border-gray-200 p-6">
          No tasks yet — add a stage above, then add tasks to it.
        </p>
      )}
      {groups.length > 0 && visibleGroups.length === 0 && (
        <p className="text-sm text-gray-500 bg-white rounded-xl border border-gray-200 p-6">
          No task on the board matches “{search.trim()}”.
        </p>
      )}

      {visibleGroups.map((group) => {
        const stageIndex = groups.findIndex((g) => g.stage === group.stage)
        const accent = stageAccent(stageIndex)
        const open = isOpen(group.stage)
        const panelId = `stage-panel-${stageIndex}`
        return (
          <div key={group.stage} className="rounded-xl border border-gray-200 overflow-hidden bg-white" style={{ borderLeft: `4px solid ${accent}` }}>
            <div className="flex items-center gap-2 bg-gray-50/80 border-b border-gray-200">
              {editingStage === group.stage ? (
                <div className="flex items-center gap-2 flex-1 px-4 py-2.5">
                  <input
                    autoFocus
                    value={stageDraft}
                    onChange={(e) => setStageDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") saveStageRename(group.stage)
                      if (e.key === "Escape") setEditingStage(null)
                    }}
                    aria-label="Stage name"
                    className="serif text-base font-semibold text-gray-900 border border-gray-300 rounded px-2 py-1 flex-1 max-w-xs"
                  />
                  <button onClick={() => saveStageRename(group.stage)} className="text-xs text-blue-600 hover:underline">Save</button>
                  <button onClick={() => setEditingStage(null)} className="text-xs text-gray-400 hover:underline">Cancel</button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => toggleStage(group.stage)}
                  aria-expanded={open}
                  aria-controls={panelId}
                  className="flex-1 flex items-center gap-2.5 px-4 py-3 text-left hover:bg-gray-100/70 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500"
                >
                  <span className={`text-gray-400 transition-transform ${open ? "rotate-90" : ""}`} aria-hidden="true">▶</span>
                  <span className="serif text-base font-semibold" style={{ color: accent }}>{group.stage}</span>
                  <span className="text-xs text-gray-400">{group.tasks.length} {group.tasks.length === 1 ? "task" : "tasks"}</span>
                </button>
              )}
            </div>

            {open && (
              <div id={panelId}>
                <ul className="divide-y divide-gray-100">
                  {group.tasks.map((t) => (
                    <li key={t.id} className="flex items-center gap-3 flex-wrap px-4 py-2 odd:bg-white even:bg-gray-50/40 hover:bg-blue-50/40 transition-colors">
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
                            aria-label="Task name"
                            className="flex-1 min-w-48 text-sm text-gray-900 border border-gray-300 rounded px-2 py-1"
                          />
                          <select value={editTag} onChange={(e) => setEditTag(e.target.value)} aria-label="Tag" className="px-2 py-1 border border-gray-300 rounded text-sm text-gray-900">
                            <option value="">No tag</option>
                            <option value="Form">Form</option>
                            <option value="Signature">Signature</option>
                          </select>
                          <button onClick={() => saveTaskEdit(t.id)} className="text-xs text-blue-600 hover:underline">Save</button>
                          <button onClick={() => setEditingTaskId(null)} className="text-xs text-gray-400 hover:underline">Cancel</button>
                        </div>
                      ) : (
                        <>
                          <span className="flex-1 min-w-0 text-sm text-gray-800 truncate">{t.title}</span>
                          <span className="flex items-center gap-1.5 shrink-0">
                            {t.tag && <TagBadge tag={t.tag} />}
                            {t.notes && <NotesBadge />}
                          </span>
                          <span className="flex items-center gap-0.5 shrink-0">
                            <IconButton
                              label={openTaskId === t.id ? "Close details" : "Open details, notes and files"}
                              active={openTaskId === t.id}
                              onClick={() => {
                                if (openTaskId === t.id) { setOpenTaskId(null); return }
                                setOpenTaskId(t.id); setNotesDraft(t.notes ?? ""); setNotesSaved(false)
                              }}
                            >
                              📄
                            </IconButton>
                            <IconButton label={`Rename ${t.title}`} onClick={() => { setEditingTaskId(t.id); setEditTitle(t.title); setEditTag(t.tag ?? "") }}>
                              ✏️
                            </IconButton>
                            <IconButton
                              label={`Move or copy ${t.title} to another stage`}
                              active={movingId === t.id}
                              onClick={() => {
                                if (movingId === t.id) { setMovingId(null); return }
                                setMovingId(t.id)
                                setMoveTarget("")
                              }}
                            >
                              ⇄
                            </IconButton>
                            <IconButton label={`Delete ${t.title}`} danger onClick={() => confirmDeleteTask(t)}>
                              🗑️
                            </IconButton>
                          </span>
                        </>
                      )}
                      {movingId === t.id && (
                        <div className="basis-full flex items-center gap-2 flex-wrap pt-2 mt-1 border-t border-gray-100">
                          <label htmlFor={`move-${t.id}`} className="text-xs text-gray-500">Send to</label>
                          <select
                            id={`move-${t.id}`}
                            autoFocus
                            value={moveTarget}
                            onChange={(e) => setMoveTarget(e.target.value)}
                            className="px-2 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-900"
                          >
                            <option value="">Choose a stage…</option>
                            {groups
                              .map((g) => g.stage)
                              .filter((s) => s !== group.stage)
                              .map((s) => <option key={s} value={s}>{s}</option>)}
                          </select>
                          <button
                            type="button"
                            onClick={() => moveOrCopy(t.id, moveTarget, false)}
                            disabled={!moveTarget || moveBusy}
                            className="px-3 py-1.5 rounded-lg text-white text-xs font-semibold disabled:bg-gray-300"
                            style={moveTarget && !moveBusy ? { background: "#1b2d45" } : undefined}
                          >
                            {moveBusy ? "Working…" : "Move here"}
                          </button>
                          <button
                            type="button"
                            onClick={() => moveOrCopy(t.id, moveTarget, true)}
                            disabled={!moveTarget || moveBusy}
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white border border-gray-300 text-gray-700 disabled:text-gray-300 disabled:border-gray-200"
                          >
                            Copy here
                          </button>
                          <button type="button" onClick={() => setMovingId(null)} className="text-xs text-gray-400 hover:underline">Cancel</button>
                          <span className="text-[11px] text-gray-400">
                            Move re-files this task; copy leaves it here too. Either way it keeps its tag, notes and linked form.
                          </span>
                        </div>
                      )}
                    </li>
                  ))}
                  {group.tasks.length === 0 && (
                    <li className="px-4 py-6 text-center">
                      <p className="text-sm text-gray-500">Nothing in this stage yet.</p>
                      <button onClick={() => { setAddingStage(group.stage); setAddTitle(""); setAddTag("") }} className="mt-1 text-sm text-blue-600 hover:underline">
                        + Add the first task
                      </button>
                    </li>
                  )}
                </ul>

                {group.tasks.some((t) => t.id === openTaskId) && (() => {
                  const t = group.tasks.find((x) => x.id === openTaskId)!
                  return (
                    <div className="px-4 py-4 bg-gray-50 border-t border-gray-200 space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="section-label">Notes for: {t.title}</p>
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
                        <p className="section-label">Linked intake form</p>
                        <div className="flex items-center gap-2 flex-wrap">
                          <select
                            value={t.form_key ?? ""}
                            onChange={(e) => setFormKey(t.id, e.target.value)}
                            aria-label="Linked intake form"
                            className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="">No form</option>
                            {forms.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
                          </select>
                          <span className="text-xs text-gray-400">{t.form_key ? "Clients fill this form from the task." : "Pick a FileFlow form to attach."}</span>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-gray-200 space-y-2">
                        <p className="section-label">Embedded form (Airtable form or any URL)</p>
                        <div className="flex items-center gap-2 flex-wrap">
                          <input
                            defaultValue={t.embed_url ?? ""}
                            onBlur={(e) => { if (e.target.value.trim() !== (t.embed_url ?? "")) setEmbedUrl(t.id, e.target.value) }}
                            placeholder="https://airtable.com/…/form — shows inside the task"
                            aria-label="Embedded form URL"
                            className="flex-1 min-w-[18rem] px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                          <span className="text-xs text-gray-400">{t.embed_url ? "Embedded in the task for clients. Clear to remove." : "Saves when you click away."}</span>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-gray-200 space-y-2">
                        <p className="section-label">Files (shown to clients with this task)</p>
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

                <div className="px-4 py-2.5 bg-gray-50 border-t border-gray-100 flex items-center gap-3 flex-wrap">
                  {addingStage === group.stage ? (
                    <form onSubmit={(e) => addTask(group.stage, e)} className="flex items-center gap-2 flex-wrap flex-1">
                      <input
                        autoFocus
                        value={addTitle}
                        onChange={(e) => setAddTitle(e.target.value)}
                        placeholder="Task name"
                        aria-label="New task name"
                        className="flex-1 min-w-48 px-3 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <select value={addTag} onChange={(e) => setAddTag(e.target.value)} aria-label="Tag" className="px-2 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-900">
                        <option value="">No tag</option>
                        <option value="Form">Form</option>
                        <option value="Signature">Signature</option>
                      </select>
                      <button type="submit" className="px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700">Add</button>
                      <button type="button" onClick={() => { setAddingStage(null); setAddTitle(""); setAddTag("") }} className="text-xs text-gray-400 hover:underline">Cancel</button>
                    </form>
                  ) : (
                    <>
                      <button onClick={() => { setAddingStage(group.stage); setAddTitle(""); setAddTag("") }} className="text-sm text-blue-600 hover:underline">
                        + Add task
                      </button>
                      <button onClick={() => { setEditingStage(group.stage); setStageDraft(group.stage) }} className="text-sm text-gray-500 hover:text-gray-900 hover:underline">
                        Rename stage
                      </button>
                      <button onClick={() => confirmDeleteStage(group.stage, group.tasks.length)} className="ml-auto text-sm text-gray-400 hover:text-red-600 hover:underline">
                        Delete stage
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        )
      })}

      <ConfirmDialog
        open={Boolean(confirm)}
        title={confirm?.title ?? ""}
        body={confirm?.body ?? ""}
        onConfirm={() => confirm?.run()}
        onCancel={() => setConfirm(null)}
      />
    </div>
  )
}
