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

const PAGE_LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  "document-requests": "Document Requests",
  pleadings: "Pleadings",
  discovery: "Discovery",
  calendar: "Calendar",
  messages: "Messages",
  chat: "Chat",
}

function SortableItem({ id }: { id: string }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex items-center gap-3 px-4 py-3 bg-white rounded-lg border ${
        isDragging ? "border-blue-400 shadow-lg opacity-80" : "border-gray-200"
      } cursor-grab active:cursor-grabbing`}
      {...attributes}
      {...listeners}
    >
      <svg className="w-4 h-4 text-gray-400 shrink-0" fill="currentColor" viewBox="0 0 20 20">
        <path d="M7 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm6 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM7 8a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm6 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm-6 6a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm6 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4z"/>
      </svg>
      <span className="text-sm font-medium text-gray-800">{PAGE_LABELS[id] ?? id}</span>
    </div>
  )
}

export default function AdminSettingsPage() {
  const [pages, setPages] = useState<string[]>([])
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle")

  const sensors = useSensors(useSensor(PointerSensor))

  useEffect(() => {
    fetch("/api/nav").then((r) => r.json()).then((data) => setPages(data.pages))
  }, [])

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (over && active.id !== over.id) {
      setPages((items) => {
        const oldIndex = items.indexOf(String(active.id))
        const newIndex = items.indexOf(String(over.id))
        return arrayMove(items, oldIndex, newIndex)
      })
    }
  }

  async function handleSave() {
    setSaveStatus("saving")
    await fetch("/api/nav", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pages }),
    })
    setSaveStatus("saved")
    setTimeout(() => setSaveStatus("idle"), 2000)
  }

  return (
    <div className="max-w-sm space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="mt-1 text-sm text-gray-500">Drag to reorder the client portal navigation.</p>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={pages} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {pages.map((page) => (
              <SortableItem key={page} id={page} />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <button
        onClick={handleSave}
        disabled={saveStatus === "saving"}
        className="px-6 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
      >
        {saveStatus === "saving" ? "Saving..." : saveStatus === "saved" ? "Saved!" : "Save Order"}
      </button>
    </div>
  )
}
