"use client"
// components/admin/tasks/AssignTab.tsx — give one or several clients a set of
// tasks. The picker filters as you type, stages can be checked as a block, and
// a successful assign can be undone for ten seconds.
import { useMemo, useState } from "react"
import { groupByStage } from "@/lib/task-stages"
import { matchesSearch, progressFor } from "@/lib/task-progress"
import ClientCombobox, { type ClientOption } from "./ClientCombobox"
import { ClientProgressCard } from "./ProgressTab"
import { TriStateCheckbox, TagBadge, UndoBanner, InlineError, ConfirmDialog } from "./bits"
import type { Template, ClientTask } from "./types"

const CONFIRM_THRESHOLD = 20

export default function AssignTab({
  templates,
  tasks,
  clients,
  labelOf,
  search,
  reload,
}: {
  templates: Template[]
  tasks: ClientTask[]
  clients: ClientOption[]
  labelOf: (clientId: string) => string
  search: string
  reload: () => Promise<void> | void
}) {
  const [selectedClients, setSelectedClients] = useState<string[]>([])
  const [selectedTemplates, setSelectedTemplates] = useState<string[]>([])
  const [dueDate, setDueDate] = useState("")
  const [filter, setFilter] = useState("")
  const [assigning, setAssigning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [undo, setUndo] = useState<{ message: string; ids: string[] } | null>(null)
  const [confirm, setConfirm] = useState<{ title: string; body: string; run: () => void } | null>(null)
  const [expandedPreview, setExpandedPreview] = useState(true)

  // The global search box narrows the picker too, so a search takes you
  // straight to the task you meant to assign.
  const effectiveFilter = filter.trim() || search.trim()

  const groups = useMemo(
    () =>
      groupByStage(templates)
        .map((g) => ({ ...g, tasks: g.tasks.filter((t) => matchesSearch(effectiveFilter, t.title, t.tag, t.stage)) }))
        .filter((g) => g.tasks.length > 0),
    [templates, effectiveFilter]
  )

  const toggleTemplate = (id: string) =>
    setSelectedTemplates((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))

  const pairs = selectedClients.length * selectedTemplates.length
  const canAssign = selectedClients.length > 0 && selectedTemplates.length > 0 && !assigning

  const disabledReason = !selectedClients.length
    ? "Pick at least one client first"
    : !selectedTemplates.length
      ? "Check at least one task to assign"
      : undefined

  const assignLabel = (() => {
    if (!selectedTemplates.length || !selectedClients.length) return "Assign"
    const taskPart = `${selectedTemplates.length} ${selectedTemplates.length === 1 ? "task" : "tasks"}`
    const clientPart =
      selectedClients.length === 1 ? labelOf(selectedClients[0]) : `${selectedClients.length} clients`
    return `Assign ${taskPart} to ${clientPart}`
  })()

  async function runAssign() {
    setAssigning(true)
    setError(null)
    const created: string[] = []
    let failed = 0
    for (const clientId of selectedClients) {
      const res = await fetch("/api/admin/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "assign",
          clientId,
          templateIds: selectedTemplates,
          dueDate: dueDate || undefined,
        }),
      }).catch(() => null)
      if (!res?.ok) { failed++; continue }
      const d = await res.json().catch(() => null)
      for (const t of d?.tasks ?? []) if (t?.id) created.push(String(t.id))
    }
    setAssigning(false)
    await reload()

    if (failed && !created.length) {
      setError("Nothing was assigned — try again.")
      return
    }
    if (failed) setError(`${failed} ${failed === 1 ? "client" : "clients"} couldn't be assigned — check the list below.`)

    const clientWord = selectedClients.length === 1 ? labelOf(selectedClients[0]) : `${selectedClients.length} clients`
    setUndo({
      message: `Assigned ${selectedTemplates.length} ${selectedTemplates.length === 1 ? "task" : "tasks"} to ${clientWord}`,
      ids: created,
    })
    setSelectedClients([])
    setSelectedTemplates([])
    setDueDate("")
  }

  function assign() {
    if (!canAssign) return
    if (pairs > CONFIRM_THRESHOLD) {
      setConfirm({
        title: `Assign ${selectedTemplates.length} tasks to ${selectedClients.length} clients?`,
        body: `That creates ${pairs} task assignments${dueDate ? `, all due ${dueDate}` : ""}. You can undo it right after.`,
        run: () => { setConfirm(null); runAssign() },
      })
      return
    }
    runAssign()
  }

  async function undoAssign() {
    if (!undo) return
    const ids = undo.ids
    setUndo(null)
    for (const id of ids) {
      await fetch("/api/admin/tasks", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, type: "task" }),
      }).catch(() => null)
    }
    await reload()
  }

  // The one client's current workload, so you can see what they already have.
  const previewClientId = selectedClients.length === 1 ? selectedClients[0] : null
  const preview = previewClientId
    ? progressFor(previewClientId, labelOf(previewClientId), tasks.filter((t) => t.client_id === previewClientId))
    : null

  return (
    <div className="space-y-4">
      {undo && <UndoBanner key={undo.message + undo.ids.length} message={undo.message} onUndo={undoAssign} onDismiss={() => setUndo(null)} />}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 items-start">
        <section className="lg:col-span-3 bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <h2 className="serif text-lg font-semibold text-gray-900">Assign tasks to a client</h2>

          <div className="flex flex-wrap gap-4 items-start">
            <div className="flex-1 min-w-[16rem]">
              <ClientCombobox clients={clients} selected={selectedClients} onChange={setSelectedClients} />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="assign-due" className="text-xs font-semibold text-gray-500">Due date (optional)</label>
              <input
                id="assign-due"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-[11px] text-gray-400">Applies to every task you check</span>
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <label htmlFor="task-filter" className="text-xs font-semibold text-gray-500">Tasks</label>
              <input
                id="task-filter"
                type="search"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Find a task…"
                className="flex-1 min-w-[12rem] px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {selectedTemplates.length > 0 && (
                <button type="button" onClick={() => setSelectedTemplates([])} className="text-xs text-gray-400 hover:text-gray-700 underline">
                  Clear {selectedTemplates.length} selected
                </button>
              )}
            </div>

            <div className="border border-gray-300 rounded-lg max-h-[420px] overflow-y-auto divide-y divide-gray-100">
              {groups.length === 0 && (
                <p className="px-3 py-4 text-sm text-gray-400">
                  {effectiveFilter ? `No task matches “${effectiveFilter}”.` : "No tasks on the board yet."}
                </p>
              )}
              {groups.map((g) => {
                const ids = g.tasks.map((t) => t.id)
                const checked = ids.every((id) => selectedTemplates.includes(id))
                const partial = !checked && ids.some((id) => selectedTemplates.includes(id))
                return (
                  <div key={g.stage}>
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 sticky top-0 z-10">
                      <TriStateCheckbox
                        checked={checked}
                        indeterminate={partial}
                        label={`Select every task in ${g.stage}`}
                        onChange={() =>
                          setSelectedTemplates((prev) =>
                            checked ? prev.filter((id) => !ids.includes(id)) : Array.from(new Set([...prev, ...ids]))
                          )
                        }
                      />
                      <span className="text-xs font-semibold text-gray-600">{g.stage}</span>
                      <span className="text-[11px] text-gray-400">{g.tasks.length}</span>
                    </div>
                    {g.tasks.map((t) => (
                      <label key={t.id} className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-800 cursor-pointer hover:bg-blue-50/60">
                        <input
                          type="checkbox"
                          checked={selectedTemplates.includes(t.id)}
                          onChange={() => toggleTemplate(t.id)}
                          className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="flex-1 min-w-0 truncate">{t.title}</span>
                        {t.tag && <TagBadge tag={t.tag} />}
                      </label>
                    ))}
                  </div>
                )
              })}
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <button
              type="button"
              onClick={assign}
              disabled={!canAssign}
              title={disabledReason}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              {assigning ? "Assigning…" : assignLabel}
            </button>
            {pairs > 0 && (
              <span className="text-xs text-gray-500">
                {pairs} {pairs === 1 ? "assignment" : "assignments"}{dueDate ? `, due ${dueDate}` : ""}
              </span>
            )}
            {disabledReason && <span className="text-xs text-gray-400">{disabledReason}.</span>}
          </div>

          {error && <InlineError message={error} onRetry={() => reload()} />}
        </section>

        <aside className="lg:col-span-2 space-y-3">
          <p className="section-label">Where they stand now</p>
          {preview ? (
            preview.total === 0 ? (
              <p className="text-sm text-gray-500 bg-white rounded-xl border border-gray-200 p-5">
                {preview.label} has no tasks yet — anything you check will be their first.
              </p>
            ) : (
              <ClientProgressCard
                progress={preview}
                expanded={expandedPreview}
                onToggle={() => setExpandedPreview((v) => !v)}
                onDueDate={() => {}}
                onStatus={() => {}}
                onRemove={() => {}}
                compact
              />
            )
          ) : (
            <p className="text-sm text-gray-500 bg-white rounded-xl border border-gray-200 p-5">
              {selectedClients.length > 1
                ? `${selectedClients.length} clients selected — pick a single client to see their current tasks.`
                : "Pick a client to see what they already have."}
            </p>
          )}
        </aside>
      </div>

      <ConfirmDialog
        open={Boolean(confirm)}
        title={confirm?.title ?? ""}
        body={confirm?.body ?? ""}
        confirmLabel="Assign"
        onConfirm={() => confirm?.run()}
        onCancel={() => setConfirm(null)}
      />
    </div>
  )
}
