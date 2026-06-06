"use client"

import { useState, useTransition } from "react"
import { saveClientLabel } from "./actions"

export default function ClientLabelEditor({
  clientId,
  label,
}: {
  clientId: string
  label: string
}) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(label)
  const [pending, startTransition] = useTransition()

  function save() {
    const next = value.trim()
    if (!next || next === label) {
      setEditing(false)
      setValue(label)
      return
    }
    startTransition(async () => {
      await saveClientLabel(clientId, next)
      setEditing(false)
    })
  }

  if (editing) {
    return (
      <span className="flex items-center gap-2">
        <input
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") save()
            if (e.key === "Escape") {
              setValue(label)
              setEditing(false)
            }
          }}
          className="text-sm font-medium text-gray-900 border border-gray-300 rounded px-2 py-1 w-48"
        />
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="text-xs text-blue-600 hover:underline disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          onClick={() => {
            setValue(label)
            setEditing(false)
          }}
          className="text-xs text-gray-400 hover:underline"
        >
          Cancel
        </button>
      </span>
    )
  }

  return (
    <span className="flex items-center gap-2">
      <span className="text-sm font-medium text-gray-900">{label || "—"}</span>
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="text-xs text-gray-400 hover:text-blue-600 hover:underline"
      >
        Edit
      </button>
    </span>
  )
}
