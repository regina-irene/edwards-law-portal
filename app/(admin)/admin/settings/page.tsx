"use client"

import { useState, useEffect } from "react"
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core"
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import PageTitle from "@/components/ui/PageTitle"
import { taglineFor } from "@/lib/taglines"
import SchemePicker from "@/components/settings/SchemePicker"
import StatusFieldsEditor from "@/components/admin/StatusFieldsEditor"
import StaffAccess from "@/components/admin/StaffAccess"
import { ConfirmDialog } from "@/components/ui/ConfirmDialog"
import { DEFAULT_SCHEME_KEY } from "@/lib/color-schemes"

const BUILTIN_LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  pleadings: "Pleadings",
  correspondence: "Correspondence",
  discovery: "Discovery",
  status: "Case Status",
  tasks: "Tasks",
  calendar: "Calendar",
  messages: "Messages",
  settings: "Settings",
}
const BUILTIN_KEYS = Object.keys(BUILTIN_LABELS)

function SortableItem({ id, label, isCustom, onDelete }: { id: string; label: string; isCustom: boolean; onDelete: (id: string) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex items-center gap-3 px-4 py-3 bg-white rounded-lg border ${isDragging ? "border-blue-400 shadow-lg opacity-80" : "border-gray-200"}`}
    >
      <span className="cursor-grab active:cursor-grabbing text-gray-400" {...attributes} {...listeners}>
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M7 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm6 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM7 8a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm6 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm-6 6a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm6 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4z"/></svg>
      </span>
      <span className="text-sm font-medium text-gray-800 flex-1">{label}</span>
      {isCustom && <span className="text-[10px] uppercase tracking-wide text-blue-500 font-semibold">Custom</span>}
      {isCustom && <button onClick={() => onDelete(id)} className="text-xs text-gray-300 hover:text-red-600">Delete</button>}
    </div>
  )
}

export default function AdminSettingsPage() {
  const [pages, setPages] = useState<string[]>([])
  const [labels, setLabels] = useState<Record<string, string>>(BUILTIN_LABELS)
  const [customKeys, setCustomKeys] = useState<Set<string>>(new Set())
  const [newTitle, setNewTitle] = useState("")
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle")
  const [scheme, setScheme] = useState(DEFAULT_SCHEME_KEY)
  const [gradient, setGradient] = useState(false)
  const [themeStatus, setThemeStatus] = useState<"idle" | "saving" | "saved">("idle")
  const [pendingDelete, setPendingDelete] = useState<string | null>(null)

  const sensors = useSensors(useSensor(PointerSensor))

  async function loadAll() {
    const [navRes, customRes] = await Promise.all([
      fetch("/api/nav").then((r) => r.json()),
      fetch("/api/admin/custom-pages").then((r) => r.json()),
    ])
    const custom: { slug: string; title: string }[] = customRes.pages ?? []
    const lbls: Record<string, string> = { ...BUILTIN_LABELS }
    custom.forEach((c) => { lbls[c.slug] = c.title })
    setLabels(lbls)
    setCustomKeys(new Set(custom.map((c) => c.slug)))

    const allKeys = [...BUILTIN_KEYS, ...custom.map((c) => c.slug)]
    const savedOrder: string[] = Array.isArray(navRes.pages) ? navRes.pages : []
    const ordered = [...savedOrder.filter((k) => allKeys.includes(k)), ...allKeys.filter((k) => !savedOrder.includes(k))]
    setPages(ordered)
  }

  async function loadAppearance() {
    try {
      const r = await fetch("/api/admin/appearance").then((res) => res.json())
      if (typeof r.scheme === "string") setScheme(r.scheme)
      setGradient(Boolean(r.gradient))
    } catch {
      // leave the defaults in place
    }
  }

  useEffect(() => { loadAll(); loadAppearance() }, [])

  async function saveAppearance() {
    setThemeStatus("saving")
    const res = await fetch("/api/admin/appearance", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scheme, gradient }),
    })
    setThemeStatus(res.ok ? "saved" : "idle")
    if (res.ok) window.location.reload()
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (over && active.id !== over.id) {
      setPages((items) => arrayMove(items, items.indexOf(String(active.id)), items.indexOf(String(over.id))))
    }
  }

  async function handleSave() {
    setSaveStatus("saving")
    await fetch("/api/nav", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pages }) })
    setSaveStatus("saved")
    setTimeout(() => setSaveStatus("idle"), 2000)
  }

  async function addPage(e: React.FormEvent) {
    e.preventDefault()
    if (!newTitle.trim()) return
    const res = await fetch("/api/admin/custom-pages", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: newTitle.trim() }) })
    if (res.ok) { setNewTitle(""); loadAll() }
  }

  async function deletePage(slug: string) {
    setPendingDelete(null)
    await fetch("/api/admin/custom-pages", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug }) })
    loadAll()
  }

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <PageTitle title="Settings" tagline={taglineFor("admin:settings")} />
        <p className="mt-1 text-sm text-gray-500">Add pages, reorder the navigation, and manage the portal.</p>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-800">Appearance</h2>
        <p className="text-xs text-gray-500">
          The look of the admin side. This is firm-wide - everyone on the admin side sees it.
          Clients pick their own scheme on their Settings page.
        </p>
        <SchemePicker
          scheme={scheme}
          gradient={gradient}
          onSchemeChange={setScheme}
          onGradientChange={setGradient}
        />
        <div className="flex items-center gap-3">
          <button
            onClick={saveAppearance}
            disabled={themeStatus === "saving"}
            className="px-6 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {themeStatus === "saving" ? "Saving..." : "Save appearance"}
          </button>
          {themeStatus === "saved" && <span className="text-sm text-green-700 font-medium">Saved! ✓</span>}
        </div>
      </section>

      {/* Above the field-visibility controls on purpose: who can get in at all
          is a bigger question than what they see once they are in. */}
      <StaffAccess />

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-800">Case Status fields clients see</h2>
        <p className="text-xs text-gray-500">
          The Case Status board is the firm&apos;s internal board - payment status, the judge,
          drafting reminders, notes. Tick a field to put it on the client&apos;s Case Status page.
          <strong> Anything left unticked stays hidden</strong>, and any field added to the board
          later starts hidden until somebody ticks it here. This applies to{" "}
          <strong>every client</strong>; override it for one client in that client&apos;s Pages
          editor.
        </p>
        <StatusFieldsEditor />
      </section>

      <section className="space-y-3 max-w-md">
        <h2 className="text-sm font-semibold text-gray-800">Add a page</h2>
        <form onSubmit={addPage} className="flex gap-2">
          <input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="New page name (e.g. Resources)" className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <button type="submit" className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700">Add</button>
        </form>
        <p className="text-xs text-gray-400">New pages start blank - edit their content in Global Pages, and turn them on/off per client in each client&apos;s Pages editor.</p>
      </section>

      <section className="space-y-3 max-w-md">
        <h2 className="text-sm font-semibold text-gray-800">Navigation order</h2>
        <p className="text-xs text-gray-500">Drag to reorder how pages appear in the client portal.</p>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={pages} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
              {pages.map((page) => (
                <SortableItem key={page} id={page} label={labels[page] ?? page} isCustom={customKeys.has(page)} onDelete={setPendingDelete} />
              ))}
            </div>
          </SortableContext>
        </DndContext>
        <button onClick={handleSave} disabled={saveStatus === "saving"} className="px-6 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
          {saveStatus === "saving" ? "Saving..." : saveStatus === "saved" ? "Saved!" : "Save Order"}
        </button>
        <p className="text-xs text-gray-400">Turn pages on/off (default for all clients) with the checkboxes in <strong>Global Pages</strong>; override per client in each client&apos;s Pages editor.</p>
      </section>

      <ConfirmDialog
        open={pendingDelete !== null}
        title={pendingDelete ? `Delete the “${labels[pendingDelete] ?? pendingDelete}” page?` : "Delete this page?"}
        body="The page comes out of the navigation and everything written on it is removed. This can't be undone."
        confirmLabel="Delete page"
        onConfirm={() => { if (pendingDelete) deletePage(pendingDelete) }}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  )
}
