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
import { RichTextEditor } from "@/components/ui/RichTextEditor"

interface Rule {
  key: string
  label: string
  description: string
  board?: string
  enabled: boolean
  mode: "approve" | "auto"
  subject: string
  body: string
  kind?: string
  noun?: string
  alsoFirm?: boolean
}

interface Placeholder {
  token: string
  explain: string
}

interface QueuedDoc {
  id: string
  title: string
  link: string
  date: string | null
}

/** What one rule did on one run. Mirrors RunSummary in lib/automation-run. */
interface RunSummary {
  ran: boolean
  reason?: string
  seeded: number
  sent: number
  queued: number
  skipped: number
  errors: string[]
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

/**
 * Say what a check actually did, in words (2026-09-04).
 *
 * The button used to report "Checked. Anything new is below." for every
 * outcome, which made four very different situations look identical: the rule
 * being off, thirty clients read with nothing new, a client skipped because
 * their board could not be read, and something genuinely found. There was no
 * way to tell them apart from the outside, so a working check and a broken one
 * looked the same.
 */
function describeRun(results: Record<string, RunSummary>, rules: Rule[]): string[] {
  const lines: string[] = []
  for (const [key, r] of Object.entries(results)) {
    const label = rules.find((x) => x.key === key)?.label ?? key
    if (!r.ran) {
      lines.push(`${label}: off, so nothing was checked.`)
      continue
    }
    const bits: string[] = []
    if (r.sent) bits.push(`${r.sent} ${r.sent === 1 ? "email" : "emails"} sent`)
    if (r.queued) bits.push(`${r.queued} waiting for you above`)
    if (r.seeded) bits.push(`${r.seeded} ${r.seeded === 1 ? "client" : "clients"} looked at for the first time (nothing sent)`)
    if (r.skipped) bits.push(`${r.skipped} skipped`)
    lines.push(`${label}: ${bits.length ? bits.join(", ") : "nothing new"}.`)
    // Named individually: "skipped" on its own tells her nothing actionable,
    // and the usual cause is one client's board that cannot be read.
    for (const e of r.errors.slice(0, 5)) lines.push(`   ${e}`)
  }
  return lines
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
  const [lastRun, setLastRun] = useState<string[]>([])
  const [confirmAuto, setConfirmAuto] = useState<Rule | null>(null)

  // The email editor: which rule is open, and the unsaved text in it.
  const [editing, setEditing] = useState<string | null>(null)
  const [draftSubject, setDraftSubject] = useState("")
  const [draftBody, setDraftBody] = useState("")
  const [savingText, setSavingText] = useState(false)
  const [preview, setPreview] = useState<{ subject: string; html: string } | null>(null)
  const [placeholders, setPlaceholders] = useState<Placeholder[]>([])
  const [defaults, setDefaults] = useState<{ subject: string; body: string } | null>(null)

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/automations").catch(() => null)
    setLoading(false)
    if (!res?.ok) {
      setError("Couldn't load the automations.")
      return
    }
    const data = (await res.json().catch(() => null)) as
      | {
          rules?: Rule[]
          pending?: Item[]
          history?: Item[]
          defaults?: { subject: string; body: string }
          placeholders?: Placeholder[]
        }
      | null
    setRules(data?.rules ?? [])
    setPending(data?.pending ?? [])
    setHistory(data?.history ?? [])
    setPlaceholders(data?.placeholders ?? [])
    setDefaults(data?.defaults ?? null)
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

  /**
   * Drop the firm logo into the wording.
   *
   * Points at /efl-logo-email.png, a PUBLIC file, and that is the whole point.
   * Images uploaded through the editor's own button land in private storage
   * behind a sign-in, which is right for a note only the firm reads and wrong
   * here: email clients fetch images anonymously, so a private one arrives as a
   * broken box in the client's inbox. Width is set in the markup because
   * Outlook ignores CSS sizing on images.
   */
  function insertLogo() {
    const origin = typeof window !== "undefined" ? window.location.origin : ""
    setDraftBody(
      `<p><img src="${origin}/efl-logo-email.png" alt="Edwards Family Law" width="120" height="120" style="width:120px;height:auto" /></p>` +
        draftBody
    )
    setPreview(null)
  }

  function openEditor(r: Rule) {
    setEditing(r.key)
    setDraftSubject(r.subject)
    setDraftBody(r.body)
    setPreview(null)
    setNote("")
    setError("")
  }

  async function saveText(key: string, useDefault = false) {
    setSavingText(true)
    setError("")
    setNote("")
    const res = await fetch("/api/admin/automations", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        key,
        // null is the signal for "back to the wording we shipped".
        subject: useDefault ? null : draftSubject,
        emailBody: useDefault ? null : draftBody,
      }),
    }).catch(() => null)
    setSavingText(false)
    if (!res?.ok) {
      setError("Couldn't save the wording.")
      return
    }
    setNote(useDefault ? "Put back to the standard wording." : "Saved.")
    setPreview(null)
    await load()
    if (useDefault && defaults) {
      setDraftSubject(defaults.subject)
      setDraftBody(defaults.body)
    }
  }

  async function showPreview(key: string) {
    setError("")
    const res = await fetch("/api/admin/automations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "preview", key, subject: draftSubject, emailBody: draftBody }),
    }).catch(() => null)
    if (!res?.ok) {
      setError("Couldn't build the preview.")
      return
    }
    const data = (await res.json().catch(() => null)) as
      | { preview?: { subject: string; html: string } }
      | null
    setPreview(data?.preview ?? null)
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
    setLastRun([])
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
    const data = (await res.json().catch(() => null)) as
      | { results?: Record<string, RunSummary> }
      | null
    await load()
    setLastRun(data?.results ? describeRun(data.results, rules) : [])
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
          <div className="flex items-center gap-2">
            {!anyOn && !loading && (
              <span className="text-xs text-gray-400">Switch an automation on first</span>
            )}
            <button
              type="button"
              onClick={checkNow}
              disabled={checking || !anyOn}
              className="text-xs px-3 py-1.5 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              {checking ? "Checking…" : "Check now"}
            </button>
          </div>
        </div>

        {lastRun.length > 0 && (
          <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 space-y-1">
            {lastRun.map((line, i) => (
              <p key={i} className="text-xs text-gray-600 whitespace-pre-wrap">
                {line}
              </p>
            ))}
            <p className="text-[11px] text-gray-400 pt-1">
              &ldquo;Nothing new&rdquo; means the document is not on the client&apos;s Airtable board
              yet. The portal reads Airtable, not Drive, so a file still syncing is invisible to it.
            </p>
          </div>
        )}

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

              <button
                type="button"
                onClick={() => (editing === r.key ? setEditing(null) : openEditor(r))}
                className="text-xs text-blue-600 hover:underline"
              >
                {editing === r.key ? "Close the email" : "Edit the email"}
              </button>

              {editing === r.key && (
                <div className="border border-gray-200 rounded-lg p-4 space-y-3 bg-gray-50">
                  <div>
                    <label
                      htmlFor={`subject-${r.key}`}
                      className="block text-xs font-semibold text-gray-500 mb-1"
                    >
                      Subject
                    </label>
                    <input
                      id={`subject-${r.key}`}
                      type="text"
                      value={draftSubject}
                      onChange={(e) => setDraftSubject(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <p className="block text-xs font-semibold text-gray-500 mb-1">Message</p>
                    {/* The portal's own editor, the same one as notes and page
                        content, so bold, colour, size and lists all work and
                        behave the way they do everywhere else in the portal. */}
                    <div className="bg-white rounded-lg">
                      <RichTextEditor value={draftBody} onChange={setDraftBody} />
                    </div>
                    <p className="text-[11px] text-gray-400 mt-1">
                      Formatting and colour carry through to the email. A plain version is sent
                      alongside it for anyone whose email program refuses formatted mail.
                    </p>
                    {/* Images added with the editor's own image button are stored
                        privately and need a sign-in, so they show as a broken box
                        in a client's inbox. Worth saying plainly rather than
                        letting her find out from a client. */}
                    {/(<img[^>]+src=")(?!https?:\/\/)?[^"]*\/api\/content-image\//.test(draftBody) && (
                      <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1.5 mt-1">
                        One of the images here was uploaded through the editor, which stores it
                        behind your sign-in. Clients will see a broken image. Use{" "}
                        <strong>Add the firm logo</strong> instead, or ask me to make another image
                        public.
                      </p>
                    )}
                  </div>

                  <div className="text-xs text-gray-500 space-y-1">
                    <p className="font-semibold text-gray-600">
                      Anything in double braces is filled in when the email is sent:
                    </p>
                    {placeholders.map((ph) => (
                      <p key={ph.token}>
                        <code className="bg-white border border-gray-200 rounded px-1 py-0.5">
                          {ph.token}
                        </code>{" "}
                        {ph.explain}
                      </p>
                    ))}
                    <p className="pt-1 text-gray-400">
                      Each document becomes its name, its date, and a <strong>Click here</strong>{" "}
                      link. The link is embedded, so a long Drive address can&apos;t be broken up by
                      the client&apos;s email program.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => saveText(r.key)}
                      disabled={savingText}
                      className="px-3 py-1.5 rounded-lg text-white text-sm font-semibold hover:opacity-90 disabled:opacity-60"
                      style={{ background: "#1b2d45" }}
                    >
                      {savingText ? "Saving…" : "Save wording"}
                    </button>
                    <button
                      type="button"
                      onClick={() => showPreview(r.key)}
                      className="px-3 py-1.5 rounded-lg border border-gray-300 text-sm text-gray-700 hover:bg-white"
                    >
                      Preview
                    </button>
                    <button
                      type="button"
                      onClick={insertLogo}
                      className="px-3 py-1.5 rounded-lg border border-gray-300 text-sm text-gray-700 hover:bg-white"
                    >
                      Add the firm logo
                    </button>
                    <button
                      type="button"
                      onClick={() => saveText(r.key, true)}
                      disabled={savingText}
                      className="text-xs text-gray-400 hover:text-gray-700 underline"
                    >
                      Back to the standard wording
                    </button>
                  </div>

                  {preview && (
                    <div className="bg-white border border-gray-200 rounded-lg p-4">
                      <p className="text-xs text-gray-400 mb-2">
                        Preview, with made-up documents. This is what a client sees.
                      </p>
                      <p className="text-sm font-semibold text-gray-900 mb-3 pb-2 border-b border-gray-100">
                        {preview.subject}
                      </p>
                      {/* The HTML here is built by lib/automation-email from her
                          own text, escaped on the way through, so the only
                          markup in it is the links that file put there. */}
                      <div dangerouslySetInnerHTML={{ __html: preview.html }} />
                    </div>
                  )}
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
                  <p className="text-sm text-gray-800">
                    <span className="font-semibold">{clientLabel(it.clientName)}</span>
                    <span className="text-gray-400">
                      {" "}
                      · {rules.find((r) => r.key === it.ruleKey)?.label ?? it.ruleKey}
                    </span>
                  </p>
                  {/* What actually went out. "3 documents" told her nothing;
                      the question when you look at this list is always which
                      filing, letter or update it was. */}
                  <ul className="mt-1 space-y-0.5">
                    {it.documents.map((d) => (
                      <li key={d.id} className="text-[13px] text-gray-600">
                        {d.link ? (
                          <a
                            href={d.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline"
                          >
                            {d.title}
                          </a>
                        ) : (
                          d.title
                        )}
                        {d.date && <span className="text-gray-400 ml-2 text-xs">{d.date}</span>}
                      </li>
                    ))}
                  </ul>
                  <p className="text-xs text-gray-400 mt-0.5">{it.clientEmail}</p>
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
        body={`"${confirmAuto?.label ?? ""}" will email the client within the hour, and nobody at the firm sees the email before it goes. You can switch this back at any time.`}
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
