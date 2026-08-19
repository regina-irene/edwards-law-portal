"use client"
// components/admin/tasks/ClientCombobox.tsx — type to find a client instead of
// hunting a 38-entry dropdown. Matches anywhere in the name (names read
// "Last, First", so prefix matching would hide people), keyboard-operable,
// and holds several clients at once for bulk assigning.
import { useEffect, useMemo, useRef, useState } from "react"

export interface ClientOption {
  id: string
  label: string
  /** Former / closed case. Kept out of the picker unless "Include archived" is on. */
  archived?: boolean
  /** "closed 12 days ago" / "access ended", when the stamp is known. */
  archiveNote?: string
}

export default function ClientCombobox({
  clients,
  selected,
  onChange,
}: {
  clients: ClientOption[]
  selected: string[]
  onChange: (ids: string[]) => void
}) {
  const [query, setQuery] = useState("")
  const [open, setOpen] = useState(false)
  const [highlight, setHighlight] = useState(0)
  const boxRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listId = "client-combobox-list"

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase()
    const pool = clients.filter((c) => !selected.includes(c.id))
    return (q ? pool.filter((c) => c.label.toLowerCase().includes(q)) : pool).slice(0, 50)
  }, [clients, selected, query])

  // Close when the click lands outside the whole control.
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", onDown)
    return () => document.removeEventListener("mousedown", onDown)
  }, [])

  const pick = (id: string) => {
    onChange([...selected, id])
    setQuery("")
    setOpen(false)
    inputRef.current?.focus()
  }

  const labelOf = (id: string) => clients.find((c) => c.id === id)?.label ?? id

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault()
      if (!open) { setOpen(true); setHighlight(0); return }
      setHighlight((h) => Math.min(h + 1, matches.length - 1))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setHighlight((h) => Math.max(h - 1, 0))
    } else if (e.key === "Enter") {
      if (open && matches[highlight]) {
        e.preventDefault()
        pick(matches[highlight].id)
      }
    } else if (e.key === "Escape") {
      setOpen(false)
    } else if (e.key === "Backspace" && !query && selected.length) {
      // Backspace on an empty box removes the last chip, as chips-in-inputs do.
      onChange(selected.slice(0, -1))
    }
  }

  return (
    <div className="flex flex-col gap-1" ref={boxRef}>
      <label htmlFor="client-combobox" className="text-xs font-semibold text-gray-500">
        Client{selected.length > 1 ? "s" : ""}
      </label>

      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-1">
          {selected.map((id) => (
            <span key={id} className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full text-white" style={{ background: "#1B2D45" }}>
              {labelOf(id)}
              <button
                type="button"
                aria-label={`Remove ${labelOf(id)}`}
                onClick={() => onChange(selected.filter((s) => s !== id))}
                className="text-white/70 hover:text-white"
              >
                ✕
              </button>
            </span>
          ))}
          {selected.length > 1 && (
            <button type="button" onClick={() => onChange([])} className="text-xs text-gray-400 hover:text-gray-700 underline">
              Clear all
            </button>
          )}
        </div>
      )}

      <div className="relative">
        <input
          id="client-combobox"
          ref={inputRef}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          autoComplete="off"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); setHighlight(0) }}
          onFocus={() => { setOpen(true); setHighlight(0) }}
          onKeyDown={onKeyDown}
          placeholder={selected.length ? "Add another client…" : "Type a client's name…"}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />

        {open && (
          <ul
            id={listId}
            role="listbox"
            className="absolute z-30 mt-1 w-full max-h-64 overflow-auto rounded-xl border border-gray-200 bg-white shadow-lg"
          >
            {matches.length === 0 && (
              <li className="px-3 py-2 text-sm text-gray-400">
                {query.trim() ? `No client matches “${query.trim()}”.` : "Every client is already selected."}
              </li>
            )}
            {matches.map((c, i) => (
              <li key={c.id} role="option" aria-selected={i === highlight}>
                <button
                  type="button"
                  onMouseEnter={() => setHighlight(i)}
                  onClick={() => pick(c.id)}
                  className={`w-full text-left px-3 py-2 text-sm ${i === highlight ? "bg-blue-50 text-blue-900" : "text-gray-800 hover:bg-gray-50"}`}
                >
                  {c.label}
                  {c.archived && (
                    <span className="ml-2 text-[11px] text-gray-400">
                      · archived{c.archiveNote ? `, ${c.archiveNote}` : ""}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
