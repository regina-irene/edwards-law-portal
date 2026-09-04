"use client"
// components/admin/Automations.tsx - the Automations page (2026-09-04).
//
// Three parts, in the order they matter:
//   1. Waiting for you   - emails found but not sent. Empty most of the time.
//   2. Automations       - the rules, off by default.
//   3. Recently          - what has gone out, so there is a record.
//
// The page is deliberately blunt about what each setting does, because "send
// automatically" means mail leaves for a client with nobody reading it first.
import { useCallback, useEffect, useState } from "react"
import { InlineError } from "@/components/ui/InlineError"
import { ConfirmDialog } from "@/components/ui/ConfirmDialog"

interface Rule {
  key: string
  label: string
  description: string
  board: string
  enabled: boolean
  mode: "approve" | "auto"
}

interface QueuedDoc {
  id: string
  title: string
  link: string
  date: string | null
}

interface Item {
  id: number
  ruleKey: string
  clientId: string
  clientName: string
  clientEmail: string
  documents: QueuedDoc[]
  status: "pending" | "sent" | "dismissed" | "failed"
  createdAt: string
  decidedAt: string | null
  decidedBy: string | null
  error: string | null
}

function clientLabel(name: string): string {
  const [last, first] = name.split("|").map((s) => s.trim())
  return first ? `${last}, ${first}` : last || name
}

function when(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/New_York",
  })
}

export default function Automations() {
  const [rules, setRules] = useState<Rule[]>([])
  const [pending, setPending] = useState<Item[]>([])
  const [history, setHistory] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [note, setNote] = useState("")
  const [busy, setBusy] = useState<number | null>(null)
  const [checking, setChecking] = useState(false)
  const [confirmAuto, setConfirmAuto] = useState<Rule | null>(null)

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/automations").catch(() => null)
    setLoading(false)
    if (!res?.ok) {
      setError("Couldn't load the automations.")
      return
    }
    const data = (await res.json().catch(() => null)) as
      | { rules?: Rule[]; pending?: Item[]; history?: Item[] }
      | null
    setRules(data?.rules ?? [])
    setPending(data?.pending ?? [])
    setHistory(data?.history ?? [])
    setError("")
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function patch(key: string, body: { enabled?: boolean; mode?: "approve" | "auto" }) {
    setError("")
    setNote("")
    // Optimistic, so a toggle feels like a toggle. Reloaded below either way.
    setRules((rs) => rs.map((r) => (r.key === key ? { ...r, ...body } : r)))
    const res = await fetch("/api/admin/automations", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, ...body }),
    }).catch(() => null)
    if (!res?.ok) setError("Couldn't save that change.")
    else if (body.enabled === true) {
      // Switching on marks everything currently on the boards as history, so
      // say so - otherwise the obvious test (add a document, press Check now)
      // looks broken when it correctly sends nothing.
      setNote(
        "On. Everything already on the boards is marked as history. Anything that arrives from now on gets emailed."
      )
    }
    await load()
  }

  async function decide(id: number, action: "send" | "dismiss") {
    setBusy(id)
    setError("")
    setNote("")
    const res = await fetch("/api/admin/automations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, id }),
    }).catch(() => null)
    setBusy(null)
    if (!res?.ok) {
      const data = (await res?.json().catch(() => null)) as { error?: string } | null
      setError(data?.error || "That didn't work.")
      await load()
      return
    }
    setNote(action === "send" ? "Sent." : "Dismissed. The client was not emailed.")
    await load()
  }

  async function checkNow() {
    setChecking(true)
    setError("")
    setNote("")
    const res = await fetch("/api/admin/automations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "run" }),
    }).catch(() => null)
    setChecking(false)
    if (!res?.ok) {
      setError("The check couldn't finish.")
      return
    }
    setNote("Checked. Anything new is below.")
    await load()
  }

  const anyOn = rules.some((r) => r.enabled)

  return (
    <div className="space-y-7">
      {/* 1. Waiting for you */}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h2 className="text-sm font-semibold text-gray-800">
            Waiting for you{pending.length > 0 && ` (${pending.length})`}
          </h2>
          <button
            type="button"
            onClick={checkNow}
            disabled={checking || !anyOn}
            className="text-xs px-3 py-1.5 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            {checking ? "Checking…" : "Check now"}
          </button>
        </div>

        {loading ? (
          <p className="text-sm text-gray-400">Loading…</p>
        ) : pending.length === 0 ? (
          <p className="text-sm text-gray-500 bg-white rounded-xl border border-gray-200 p-5">
            Nothing waiting. When a new document appears on a client&apos;s board, the email to that
            client will show up here for you to read before it goes.
          </p>
        ) : (
          <div className="space-y-3">
            {pending.map((it) => (
              <div key={it.id} className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
                <div className="flex items-baseline justify-between gap-3 flex-wrap">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{clientLabel(it.clientName)}</p>
                    <p className="text-xs text-gray-500">
                      {it.clientEmail} · {rules.find((r) => r.key === it.ruleKey)?.label ?? it.ruleKey} ·{" "}
                      {when(it.createdAt)}
                    </p>
                  </div>
                  <span className="text-xs text-gray-400">
                    {it.documents.length} {it.documents.length === 1 ? "document" : "documents"}
                  </span>
                </div>

                <ul className="text-sm text-gray-700 space-y-1 border-l-2 border-gray-100 pl-3">
                  {it.documents.map((d) => (
                    <li key={d.id} className="truncate">
                      <a
                        href={d.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline"
                      >
                        {d.title}
                      </a>
                      {d.date && <span className="text-gray-400 ml-2 text-xs">{d.date}</span>}
                    </li>
                  ))}
                </ul>

                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => decide(it.id, "send")}
                    disabled={busy === it.id}
                    className="px-3 py-1.5 rounded-lg text-white text-sm font-semibold hover:opacity-90 disabled:opacity-60"
                    style={{ background: "#1b2d45" }}
                  >
                    {busy === it.id ? "Sending…" : "Send to client"}
                  </button>
                  <button
                    type="button"
                    onClick={() => decide(it.id, "dismiss")}
                    disabled={busy === it.id}
                    className="px-3 py-1.5 rounded-lg border border-gray-300 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-60"
                  >
                    Don&apos;t send
                  </button>
                  <span className="text-xs text-gray-400">
                    Dismissing does not hide the document. The client still sees it on their portal.
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 2. The rules */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-800">Automations</h2>
        <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
          {rules.map((r) => (
            <div key={r.key} className="p-5 space-y-3">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900">{r.label}</p>
                  <p className="text-sm text-gray-500 mt-0.5">{r.description}</p>
                </div>
                <label className="shrink-0 inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={r.enabled}
                    onChange={(e) => patch(r.key, { enabled: e.target.checked })}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  <span className="text-sm text-gray-700">{r.enabled ? "On" : "Off"}</span>
                </label>
              </div>

              {r.enabled && (
                <div className="flex flex-wrap items-center gap-4 pl-1">
                  <label className="inline-flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name={`mode-${r.key}`}
                      checked={r.mode === "approve"}
                      onChange={() => patch(r.key, { mode: "approve" })}
                      className="h-4 w-4"
                    />
                    <span className="text-sm text-gray-700">Show me first</span>
                  </label>
                  <label className="inline-flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name={`mode-${r.key}`}
                      checked={r.mode === "auto"}
                      onChange={() => (r.mode === "auto" ? null : setConfirmAuto(r))}
                      className="h-4 w-4"
                    />
                    <span className="text-sm text-gray-700">Send automatically</span>
                  </label>
                </div>
              )}
            </div>
          ))}
          {rules.length === 0 && !loading && (
            <p className="p-5 text-sm text-gray-400">No automations available.</p>
          )}
        </div>

        <div className="text-xs text-gray-400 space-y-2">
          <p>
            The portal checks every hour. Switching an automation on marks everything already on
            your clients&apos; boards as history, so it never emails anyone their old filings. Only
            documents that arrive after that count as new.
          </p>
          <p>
            If more than 8 documents appear at once, that goes to &ldquo;Waiting for you&rdquo; even
            on automatic, because it is usually Drive re-syncing rather than a filing day.
          </p>
          <p>
            <strong className="text-gray-500">To test it:</strong> switch the automation on, then
            add a document to a client&apos;s Drive folder and wait for it to show on their Airtable
            board, then press Check now. If the document is not on the Airtable board yet, there is
            nothing for the portal to see.
          </p>
        </div>
      </section>

      {/* 3. What has gone out */}
      {history.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-gray-800">Recently</h2>
          <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
            {history.map((it) => (
              <div key={it.id} className="px-5 py-3 flex items-baseline justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm text-gray-800 truncate">
                    {clientLabel(it.clientName)}
                    <span className="text-gray-400">
                      {" "}
                      · {it.documents.length}{" "}
                      {it.documents.length === 1 ? "document" : "documents"}
                    </span>
                  </p>
                  {it.error && <p className="text-xs text-red-600 mt-0.5">{it.error}</p>}
                </div>
                <span className="shrink-0 text-xs text-gray-400">
                  {it.status === "sent"
                    ? "Sent"
                    : it.status === "dismissed"
                      ? "Not sent"
                      : "Failed"}{" "}
                  {when(it.decidedAt ?? it.createdAt)}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {note && !error && <p className="text-sm text-green-700">{note}</p>}
      {error && <InlineError message={error} onRetry={() => void load()} />}

      <ConfirmDialog
        open={confirmAuto !== null}
        title="Send these without showing you first?"
        body={`New documents on the ${confirmAuto?.board === "pleadings" ? "Pleadings" : "Correspondence"} board will be emailed to the client within the hour, with a link to the document. Nobody at the firm sees the email before it goes. You can switch this back at any time.`}
        confirmLabel="Send automatically"
        onConfirm={() => {
          if (confirmAuto) void patch(confirmAuto.key, { mode: "auto" })
          setConfirmAuto(null)
        }}
        onCancel={() => setConfirmAuto(null)}
      />
    </div>
  )
}
