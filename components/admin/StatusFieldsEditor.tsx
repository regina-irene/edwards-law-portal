"use client"
// components/admin/StatusFieldsEditor.tsx - picks which fields from the Case
// Status board a client's Case Status page shows.
//
// Two modes, same component and same route so there's one pattern to learn:
//   no clientId  → the firm-wide setting, a tick box per field
//   a clientId   → that client's override, three states per field
//
// The board is the firm's internal one. Anything not ticked stays hidden, and
// that includes every field nobody has looked at yet - the copy below says so
// in as many words, because this is the screen where somebody could get it
// wrong.
import { useCallback, useEffect, useState } from "react"
import { InlineError } from "@/components/ui/InlineError"

type Prefs = Record<string, boolean>
type FieldMode = "inherit" | "show" | "hide"

interface StatusFieldsPayload {
  fields?: string[]
  discovered?: number
  defaults?: string[]
  global?: Prefs
  client?: Prefs | null
}

export default function StatusFieldsEditor({ clientId }: { clientId?: string }): React.ReactElement {
  const perClient = Boolean(clientId)

  const [fields, setFields] = useState<string[]>([])
  const [defaults, setDefaults] = useState<string[]>([])
  const [globalPrefs, setGlobalPrefs] = useState<Prefs>({})
  const [clientPrefs, setClientPrefs] = useState<Prefs>({})
  const [boardRead, setBoardRead] = useState(true)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [loadError, setLoadError] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const load = useCallback(
    async (refresh: boolean): Promise<void> => {
      setLoading(true)
      setLoadError(false)
      try {
        const qs = new URLSearchParams()
        if (clientId) qs.set("clientId", clientId)
        if (refresh) qs.set("refresh", "1")
        const res = await fetch(`/api/admin/status-fields?${qs.toString()}`)
        if (!res.ok) throw new Error("load failed")
        const data = (await res.json()) as StatusFieldsPayload
        setFields(Array.isArray(data.fields) ? data.fields : [])
        setDefaults(Array.isArray(data.defaults) ? data.defaults : [])
        setGlobalPrefs(data.global ?? {})
        setClientPrefs(data.client ?? {})
        setBoardRead(typeof data.discovered === "number" ? data.discovered > 0 : true)
      } catch {
        setLoadError(true)
      } finally {
        setLoading(false)
      }
    },
    [clientId]
  )

  useEffect(() => {
    void load(false)
  }, [load])

  // Firm-wide answer for a field: the saved setting, or the portal's default.
  const firmShows = (name: string): boolean => globalPrefs[name] ?? defaults.includes(name)

  const modeOf = (name: string): FieldMode => {
    const override = clientPrefs[name]
    if (override === undefined) return "inherit"
    return override ? "show" : "hide"
  }

  function setMode(name: string, mode: FieldMode): void {
    setSaved(false)
    setClientPrefs((prev) => {
      const next: Prefs = { ...prev }
      if (mode === "inherit") delete next[name]
      else next[name] = mode === "show"
      return next
    })
  }

  function toggleFirm(name: string, on: boolean): void {
    setSaved(false)
    setGlobalPrefs((prev) => ({ ...prev, [name]: on }))
  }

  async function save(): Promise<void> {
    setSaving(true)
    setSaveError(null)
    setSaved(false)
    try {
      // Firm-wide saves write an explicit answer for every field on screen, so
      // the stored setting is a complete record of what was decided. Per-client
      // saves write ONLY the overrides - a field left on "use firm setting" is
      // absent from the map and inherits.
      const prefs: Prefs = {}
      if (perClient) {
        for (const [name, value] of Object.entries(clientPrefs)) prefs[name] = value
      } else {
        for (const name of fields) prefs[name] = firmShows(name)
      }
      const res = await fetch("/api/admin/status-fields", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId: clientId ?? null, prefs }),
      })
      if (!res.ok) {
        const detail = (await res.json().catch(() => null)) as { error?: string } | null
        throw new Error(detail?.error || "That didn't save - nothing was changed.")
      }
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "That didn't save - nothing was changed.")
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <p className="text-sm text-gray-400">Reading the Case Status board…</p>
  }

  if (loadError) {
    return (
      <div>
        <InlineError
          message="Couldn't read the Case Status board just now, so nothing is listed."
          onRetry={() => void load(true)}
        />
      </div>
    )
  }

  const selectCls =
    "text-xs border border-gray-300 rounded-lg px-2 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"

  return (
    <div className="space-y-3">
      {!boardRead && (
        <p className="text-xs text-amber-700">
          The Status board didn&apos;t answer, so this list is only the fields the portal already
          shows. Try again in a moment to see the rest.
        </p>
      )}

      <div className="border border-gray-200 rounded-xl bg-white divide-y divide-gray-100 max-h-[26rem] overflow-y-auto">
        {fields.length === 0 && <p className="text-sm text-gray-400 px-4 py-3">No fields found.</p>}
        {fields.map((name) => (
          <div key={name} className="flex items-center gap-3 px-4 py-2">
            {perClient ? (
              <>
                <span className="text-sm text-gray-800 flex-1 break-words">{name}</span>
                {modeOf(name) !== "inherit" && (
                  <span className="text-[10px] uppercase tracking-wide font-semibold text-blue-500">
                    Override
                  </span>
                )}
                <select
                  value={modeOf(name)}
                  onChange={(e) => setMode(name, e.target.value as FieldMode)}
                  className={selectCls}
                >
                  <option value="inherit">
                    Use firm setting ({firmShows(name) ? "shown" : "hidden"})
                  </option>
                  <option value="show">Always show</option>
                  <option value="hide">Always hide</option>
                </select>
              </>
            ) : (
              <label className="flex items-center gap-3 flex-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={firmShows(name)}
                  onChange={(e) => toggleFirm(name, e.target.checked)}
                  className="w-4 h-4 accent-blue-600 flex-shrink-0"
                />
                <span className="text-sm text-gray-800 break-words">{name}</span>
                {defaults.includes(name) && (
                  <span className="text-[10px] uppercase tracking-wide text-gray-400 font-semibold">
                    Shown today
                  </span>
                )}
              </label>
            )}
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <button
          onClick={() => void save()}
          disabled={saving}
          className="px-6 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? "Saving…" : perClient ? "Save this client's fields" : "Save field visibility"}
        </button>
        {saved && <span className="text-sm text-green-700 font-medium">Saved! ✓</span>}
        <button
          onClick={() => void load(true)}
          disabled={saving}
          className="text-xs text-blue-600 hover:underline disabled:opacity-50"
        >
          Re-read the board
        </button>
      </div>
      {saveError && <InlineError message={saveError} onRetry={() => void save()} />}
    </div>
  )
}
