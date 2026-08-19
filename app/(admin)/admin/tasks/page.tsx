// app/(admin)/admin/tasks/page.tsx - Tasks, split into three tabs: assign work,
// keep the task board, and see where every client stands. Tabs are local state
// only, so switching never refetches.
"use client"

import { useState, useEffect, useCallback } from "react"
import PageTitle from "@/components/ui/PageTitle"
import { taglineFor } from "@/lib/taglines"
import { matchesSearch } from "@/lib/task-progress"
import AssignTab from "@/components/admin/tasks/AssignTab"
import TemplatesTab from "@/components/admin/tasks/TemplatesTab"
import ProgressTab from "@/components/admin/tasks/ProgressTab"
import { SkeletonRows, InlineError } from "@/components/admin/tasks/bits"
import type { ClientOption } from "@/components/admin/tasks/ClientCombobox"
import type { Template, ClientTask, Attachment, FormSummary, TabKey } from "@/components/admin/tasks/types"

const TABS: { key: TabKey; label: string }[] = [
  { key: "assign", label: "Assign" },
  { key: "templates", label: "Task board" },
  { key: "progress", label: "Progress" },
]

export default function AdminTasksPage() {
  const [templates, setTemplates] = useState<Template[]>([])
  const [tasks, setTasks] = useState<ClientTask[]>([])
  const [attachments, setAttachments] = useState<Record<string, Attachment[]>>({})
  const [forms, setForms] = useState<FormSummary[]>([])
  // The WHOLE roster, archived included: labelOf below names every assigned
  // task, and a task assigned before a case closed still needs its client's
  // name. AssignTab is the one that hides archived clients from the picker.
  const [clientList, setClientList] = useState<ClientOption[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)

  const [tab, setTab] = useState<TabKey>("assign")
  const [search, setSearch] = useState("")
  const [newStageName, setNewStageName] = useState("")
  const [stageError, setStageError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/tasks").catch(() => null)
    if (res?.ok) {
      const d = await res.json()
      setTemplates(d.templates ?? [])
      setTasks(d.tasks ?? [])
      setAttachments(d.attachmentsByTemplate ?? {})
      setLoadError(false)
    } else {
      setLoadError(true)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
    fetch("/api/admin/fileflow-forms").then((r) => r.json()).then((d) => setForms(d.forms ?? [])).catch(() => {})
    fetch("/api/admin/clients-list").then((r) => r.json()).then((d) => setClientList(d.clients ?? [])).catch(() => {})
  }, [load])

  const labelOf = useCallback(
    (id: string) => clientList.find((c) => c.id === id)?.label ?? id,
    [clientList]
  )

  // Typing in the search box should land you where the matches are. Done as the
  // search changes rather than in an effect, so there's no second render pass.
  function onSearchChange(next: string) {
    setSearch(next)
    const q = next.trim()
    if (!q) return
    const inBoard = templates.some((t) => matchesSearch(q, t.title, t.tag, t.stage))
    const inAssigned = tasks.some((t) => matchesSearch(q, t.title, t.stage, t.tag, labelOf(t.client_id)))
    if (inBoard && !inAssigned) setTab("templates")
    else if (inAssigned && !inBoard) setTab("progress")
  }

  async function addStage(e: React.FormEvent) {
    e.preventDefault()
    const name = newStageName.trim()
    if (!name) return
    setStageError(null)
    const res = await fetch("/api/admin/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "create_template", title: "New task", stage: name }),
    }).catch(() => null)
    if (!res?.ok) { setStageError("Couldn't add that stage."); return }
    setNewStageName("")
    setTab("templates")
    await load()
  }

  const matchCount = search.trim()
    ? templates.filter((t) => matchesSearch(search, t.title, t.tag, t.stage)).length +
      tasks.filter((t) => matchesSearch(search, t.title, t.stage, t.tag, labelOf(t.client_id))).length
    : 0

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header and tabs stay put while the lists scroll under them. */}
      <div className="sticky top-0 z-30 -mx-6 md:-mx-10 px-6 md:px-10 pt-1 pb-2 bg-[#FBF8F3]/95 backdrop-blur border-b border-gray-200">
        <PageTitle
          title="Tasks"
          tagline={taglineFor("admin:tasks")}
          actions={
            <form onSubmit={addStage} className="flex items-center gap-2">
              <label htmlFor="new-stage" className="sr-only">New stage name</label>
              <input
                id="new-stage"
                value={newStageName}
                onChange={(e) => setNewStageName(e.target.value)}
                placeholder="New stage name"
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button type="submit" className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700">+ Add stage</button>
            </form>
          }
        />
        {stageError && <InlineError message={stageError} />}

        <div className="mt-2 flex items-center gap-2 flex-wrap">
          <div role="tablist" aria-label="Tasks views" className="flex items-center gap-1">
            {TABS.map((t) => (
              <button
                key={t.key}
                role="tab"
                aria-selected={tab === t.key}
                onClick={() => setTab(t.key)}
                className={`px-3.5 py-1.5 rounded-full text-sm font-semibold border transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  tab === t.key ? "text-white border-transparent" : "bg-white text-gray-600 border-gray-300 hover:border-gray-400"
                }`}
                style={tab === t.key ? { background: "#1b2d45" } : undefined}
              >
                {t.label}
                {t.key === "progress" && tasks.length > 0 && (
                  <span className={tab === t.key ? "ml-1.5 opacity-70" : "ml-1.5 text-gray-400"}>{tasks.length}</span>
                )}
              </button>
            ))}
          </div>

          <div className="ml-auto flex items-center gap-2">
            <label htmlFor="task-search" className="sr-only">Search tasks</label>
            <input
              id="task-search"
              type="search"
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search tasks, clients, stages…"
              className="w-64 max-w-[60vw] px-3 py-2 border border-gray-300 rounded-xl text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {search.trim() && (
              <button type="button" onClick={() => setSearch("")} className="text-xs text-gray-400 hover:text-gray-700 underline">
                Clear
              </button>
            )}
          </div>
        </div>
        {search.trim() && (
          <p className="mt-1 text-xs text-gray-400">
            {matchCount} {matchCount === 1 ? "match" : "matches"} for “{search.trim()}” - showing them across every tab.
          </p>
        )}
      </div>

      <div className="pt-5 pb-10">
        {loading ? (
          <SkeletonRows rows={6} />
        ) : loadError ? (
          <p className="text-sm text-red-600 bg-white rounded-xl border border-red-200 p-5">
            Tasks couldn&apos;t be loaded right now.{" "}
            <button type="button" onClick={() => load()} className="underline hover:text-red-800">Try again</button>
          </p>
        ) : tab === "assign" ? (
          <AssignTab
            templates={templates}
            tasks={tasks}
            clients={clientList}
            labelOf={labelOf}
            search={search}
            reload={load}
          />
        ) : tab === "templates" ? (
          <TemplatesTab
            templates={templates}
            attachments={attachments}
            forms={forms}
            search={search}
            reload={load}
          />
        ) : (
          <ProgressTab tasks={tasks} labelOf={labelOf} search={search} reload={load} />
        )}
      </div>
    </div>
  )
}
