"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useSearchParams } from "next/navigation"
import { collectDroppedFiles, dragHasFiles } from "@/lib/drop-files"
import { RichTextEditor } from "@/components/ui/RichTextEditor"
import MessageBody from "@/components/messages/MessageBody"
import { bodyToHtml, bodyToPlainText, escapeHtml, isEmptyRich } from "@/lib/message-format"

const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024

interface Conversation {
  id: string
  name: string
  email: string
  preview: string
  lastAt: string | null
  unread: number
}
interface Msg {
  id: string
  sender: "client" | "firm"
  body: string
  created_at: string
  sms_status?: "notification" | "full" | "inbound" | null
  email_status?: "notification" | null
  files?: { id: string; file_name: string }[]
}

function initials(name: string) {
  return name.split(/[\s,|]+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("") || "?"
}
function relDay(d: string) {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" })
}
function timeOf(d: string) {
  return new Date(d).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
}
function dayLabel(d: string) {
  return new Date(d).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })
}

export default function MessageCenter() {
  const params = useSearchParams()
  const [convos, setConvos] = useState<Conversation[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [messages, setMessages] = useState<Msg[]>([])
  const [search, setSearch] = useState("")
  const [body, setBody] = useState("")
  const [sending, setSending] = useState(false)
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const [dropActive, setDropActive] = useState(false)
  const [fileNotice, setFileNotice] = useState<string | null>(null)
  const [attachProgress, setAttachProgress] = useState<string | null>(null)
  const [alsoText, setAlsoText] = useState(false)
  const [smsNotice, setSmsNotice] = useState<string | null>(null)
  const [watchOn, setWatchOn] = useState(false)
  const [watchPhone, setWatchPhone] = useState("")
  const [copied, setCopied] = useState(false)
  // Formatting mode swaps the one-line composer for the full rich-text editor.
  // Off by default so quick replies stay quick (Enter still sends).
  const [rich, setRich] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [sendError, setSendError] = useState<string | null>(null)

  // Drafts are per client (2026-08-18). Previously the composer, the queued
  // attachments and the "also send as text" checkbox were single pieces of
  // state, so switching conversations mid-reply left the half-typed message
  // aimed at a different client — a confidentiality problem, not just a UX one.
  const drafts = useRef<Record<string, { body: string; alsoText: boolean; rich: boolean }>>({})
  const selectedRef = useRef<string | null>(null)

  // load the "text me on reply" state for the open conversation
  useEffect(() => {
    if (!selected) return
    fetch(`/api/admin/sms-watch?clientId=${encodeURIComponent(selected)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d) { setWatchOn(Boolean(d.enabled)); setWatchPhone(d.adminPhone ?? "") } })
      .catch(() => {})
  }, [selected])

  async function toggleWatch() {
    if (!selected) return
    const next = !watchOn
    let adminPhone: string | undefined
    if (next && !watchPhone) {
      const entered = window.prompt("What cell number should reply alerts go to? (one-time setup)")
      if (!entered) return
      adminPhone = entered
    }
    const res = await fetch("/api/admin/sms-watch", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId: selected, enabled: next, ...(adminPhone ? { adminPhone } : {}) }),
    })
    if (res.ok) {
      setWatchOn(next)
      if (adminPhone) setWatchPhone(adminPhone)
    } else {
      const d = await res.json().catch(() => null)
      alert(d?.error ?? "Could not update the setting")
    }
  }
  const threadRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  // dragenter/dragleave also fire for child elements; counting keeps the
  // overlay from flickering as the pointer crosses bubbles.
  const dragDepth = useRef(0)

  // Attach files from a drop or the paperclip, holding back anything too big
  // for the server so it fails here with an explanation instead of silently
  // on send.
  const attachFiles = useCallback((incoming: File[]) => {
    if (incoming.length === 0) return
    const tooBig = incoming.filter((f) => f.size > MAX_ATTACHMENT_BYTES)
    const ok = incoming.filter((f) => f.size <= MAX_ATTACHMENT_BYTES)
    if (ok.length) setPendingFiles((p) => [...p, ...ok])
    setFileNotice(
      tooBig.length
        ? `Too big to attach (25 MB max): ${tooBig.map((f) => f.name).join(", ")}`
        : null
    )
  }, [])

  // A file dropped anywhere else on the page would make the browser navigate
  // away and lose the half-typed reply — swallow those drops while open.
  useEffect(() => {
    const swallow = (e: DragEvent) => {
      if (dragHasFiles(e.dataTransfer)) e.preventDefault()
    }
    window.addEventListener("dragover", swallow)
    window.addEventListener("drop", swallow)
    return () => {
      window.removeEventListener("dragover", swallow)
      window.removeEventListener("drop", swallow)
    }
  }, [])

  const loadConvos = useCallback(async () => {
    try {
      const r = await fetch("/api/admin/conversations")
      if (!r.ok) throw new Error(String(r.status))
      setConvos((await r.json()).conversations ?? [])
      setLoadError(null)
    } catch {
      // Never let a failed fetch render as "No conversations." — that reads as
      // "there is nothing here", which is a different and wrong statement.
      setLoadError("Couldn't load conversations. Check your connection.")
    }
  }, [])

  useEffect(() => { loadConvos() }, [loadConvos])

  // Poll while the tab is visible. The client side polls every 30s, so without
  // this the firm never saw a new message until they clicked away and back.
  // (2026-08-18)
  useEffect(() => {
    const tick = () => {
      if (document.visibilityState !== "visible") return
      loadConvos()
      if (selectedRef.current) loadThread(selectedRef.current)
    }
    const id = setInterval(tick, 20_000)
    document.addEventListener("visibilitychange", tick)
    return () => {
      clearInterval(id)
      document.removeEventListener("visibilitychange", tick)
    }
    // loadThread is stable; selected is read through a ref so the interval
    // isn't torn down and recreated on every conversation switch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadConvos])

  // Preselect from ?c=
  useEffect(() => {
    const c = params.get("c")
    if (c) setSelected(c)
  }, [params])

  // Park the outgoing conversation's draft and restore the incoming one.
  // Attachments are deliberately NOT carried across: a File queued for one
  // client must never end up attached to another.
  function selectConversation(id: string) {
    const prev = selectedRef.current
    if (prev && prev !== id) {
      drafts.current[prev] = { body, alsoText, rich }
    }
    const next = drafts.current[id] ?? { body: "", alsoText: false, rich: false }
    setBody(next.body)
    setAlsoText(next.alsoText)
    setRich(next.rich)
    setPendingFiles([])
    setFileNotice(null)
    setSmsNotice(null)
    setSendError(null)
    setSelected(id)
  }

  useEffect(() => { selectedRef.current = selected }, [selected])

  const loadThread = useCallback(async (id: string) => {
    try {
      const r = await fetch(`/api/admin/chat?clientId=${encodeURIComponent(id)}`)
      if (!r.ok) throw new Error(String(r.status))
      setMessages((await r.json()).messages ?? [])
      setLoadError(null)
      loadConvos() // refresh unread after marking read
    } catch {
      setLoadError("Couldn't load this conversation. Check your connection.")
    }
  }, [loadConvos])

  useEffect(() => {
    if (selected) loadThread(selected)
  }, [selected, loadThread])

  // Only stick to the bottom if the reader is already near it — otherwise a
  // poll would yank them away from something they're reading further up.
  useEffect(() => {
    const el = threadRef.current
    if (!el) return
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120
    if (nearBottom) el.scrollTop = el.scrollHeight
  }, [messages])

  // In formatting mode `body` holds HTML, so "is it empty" needs the rich check.
  const composerEmpty = rich ? isEmptyRich(body) : !body.trim()

  async function send() {
    if ((composerEmpty && pendingFiles.length === 0) || !selected) return
    setSending(true)
    setSmsNotice(null)
    setSendError(null)
    const res = await fetch("/api/admin/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId: selected,
        body: composerEmpty ? "📎 Attachment" : rich ? body : body.trim(),
        sms: alsoText,
      }),
    }).catch(() => null)
    if (res?.ok) {
      const d = await res.json()
      if (d.sms || d.email) {
        const parts: string[] = []
        if (d.sms) {
          parts.push(
            d.sms.sent
              ? alsoText ? "📱 Message sent as text" : "📱 Text notification sent"
              : `📱 Text not sent — ${d.sms.reason}`
          )
        }
        if (d.email) {
          parts.push(d.email.sent ? "📧 Email alert sent" : `📧 Email not sent — ${d.email.reason}`)
        }
        setSmsNotice(parts.join("  ·  "))
      }
      // Attachments upload one at a time against the saved message; report any
      // that don't make it rather than dropping them quietly.
      const failed: string[] = []
      for (let i = 0; i < pendingFiles.length; i++) {
        const f = pendingFiles[i]
        setAttachProgress(pendingFiles.length > 1 ? `Attaching ${i + 1} of ${pendingFiles.length}…` : `Attaching ${f.name}…`)
        const fd = new FormData()
        fd.append("file", f)
        fd.append("messageId", d.message.id)
        const up = await fetch("/api/message-files", { method: "POST", body: fd }).catch(() => null)
        if (!up?.ok) failed.push(f.name)
      }
      setAttachProgress(null)
      setFileNotice(failed.length ? `Couldn't attach: ${failed.join(", ")}` : null)
      setBody("")
      setPendingFiles([])
      setAlsoText(false)
      delete drafts.current[selected]
      await loadThread(selected)
      loadConvos()
    } else {
      // Never fail silently: the draft stays put and says so, rather than
      // looking identical to a message that went through. (2026-08-18)
      setSendError("Not sent. Your message is still here — check your connection and try again.")
    }
    setSending(false)
  }

  function channelOf(m: Msg): string {
    if (m.sender === "firm") {
      let c = m.sms_status === "full" ? "portal + texted" : m.sms_status === "notification" ? "portal + text alert" : "portal"
      if (m.email_status === "notification") c += " + emailed"
      return c
    }
    return m.sms_status === "inbound" ? "text message" : "portal"
  }

  function exportTxt() {
    const conv = convos.find((c) => c.id === selected)
    const lines = messages.map((m) => `[${new Date(m.created_at).toLocaleString("en-US")}] ${m.sender === "firm" ? "Firm" : conv?.name ?? "Client"} (via ${channelOf(m)}): ${bodyToPlainText(m.body)}`)
    const blob = new Blob([`Conversation with ${conv?.name ?? ""}\n\n${lines.join("\n")}`], { type: "text/plain" })
    const a = document.createElement("a")
    a.href = URL.createObjectURL(blob)
    a.download = `messages-${(conv?.name ?? "client").replace(/[^\w]+/g, "-")}.txt`
    a.click()
  }

  // Copy the whole thread to the clipboard in BOTH flavors: rich HTML for Word
  // and Outlook, plain text for everything else. Without the HTML flavor Word
  // collapses the thread into one run-on paragraph. (2026-08-18)
  async function copyConversation() {
    const conv = convos.find((c) => c.id === selected)
    const who = (m: Msg) => (m.sender === "firm" ? "Firm" : conv?.name ?? "Client")
    const stamp = (m: Msg) => new Date(m.created_at).toLocaleString("en-US")

    const plain =
      `Conversation with ${conv?.name ?? ""}\n\n` +
      messages.map((m) => `[${stamp(m)}] ${who(m)} (via ${channelOf(m)}):\n${bodyToPlainText(m.body)}`).join("\n\n")

    const html =
      `<div style="font-family:Calibri,Arial,sans-serif;font-size:11pt">` +
      `<p style="margin:0 0 12px"><b>Conversation with ${escapeHtml(conv?.name ?? "")}</b></p>` +
      messages
        .map(
          (m) =>
            `<p style="margin:0 0 12px">` +
            `<b>${escapeHtml(who(m))}</b> &mdash; ${escapeHtml(stamp(m))} ` +
            `<span style="color:#666">(via ${escapeHtml(channelOf(m))})</span><br>` +
            bodyToHtml(m.body) +
            `</p>`
        )
        .join("") +
      `</div>`

    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          "text/plain": new Blob([plain], { type: "text/plain" }),
          "text/html": new Blob([html], { type: "text/html" }),
        }),
      ])
    } catch {
      // Older browsers, or a page without clipboard-write permission.
      await navigator.clipboard.writeText(plain)
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const q = search.trim().toLowerCase()
  const filtered = q ? convos.filter((c) => c.name.toLowerCase().includes(q) || c.preview.toLowerCase().includes(q) || c.email.toLowerCase().includes(q)) : convos
  const active = convos.find((c) => c.id === selected)

  let lastDay = ""

  return (
    <div className="flex h-[calc(100vh-14rem)] max-w-5xl mx-auto rounded-xl border border-gray-200 overflow-hidden bg-white">
      {/* Conversation list */}
      <div className="w-80 shrink-0 border-r border-gray-200 flex flex-col" style={{ background: "#FBF8F3" }}>
        <div className="p-3 border-b border-gray-200">
          <div className="flex items-center justify-between gap-2 mb-2">
            <h2 className="serif text-lg font-semibold text-gray-900">Messages</h2>
          </div>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search messages…" className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div className="flex-1 overflow-auto">
          {filtered.map((c) => (
            <button key={c.id} onClick={() => selectConversation(c.id)} className={`w-full text-left flex gap-3 px-3 py-3 border-b border-gray-100 transition-colors ${selected === c.id ? "bg-[#efe7da]" : "hover:bg-[#f3ede4]"}`} style={{ borderLeft: `3px solid ${selected === c.id ? "#1B2D45" : "transparent"}` }}>
              <span className="w-9 h-9 rounded-full flex items-center justify-center text-[11px] font-semibold shrink-0" style={{ background: "#1B2D45", color: "#fff" }}>{initials(c.name)}</span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-gray-900 truncate">{c.name}</span>
                  <span className="text-[10px] text-gray-400 shrink-0">{c.lastAt ? relDay(c.lastAt) : ""}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-gray-500 truncate">{c.preview || "No messages yet"}</span>
                  <span className="flex items-center gap-1 shrink-0">
                    {c.id !== selected && drafts.current[c.id]?.body && (
                      <span className="px-1 rounded bg-amber-100 text-amber-800 text-[9px] font-semibold" title="You have an unsent draft for this client">Draft</span>
                    )}
                    {c.unread > 0 && <span className="min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">{c.unread}</span>}
                  </span>
                </div>
              </div>
            </button>
          ))}
          {loadError ? (
            <p className="text-sm text-amber-700 text-center py-8 px-3">{loadError}</p>
          ) : (
            filtered.length === 0 && <p className="text-sm text-gray-400 text-center py-8">No conversations.</p>
          )}
        </div>
      </div>

      {/* Thread — drop files anywhere over it to attach them to the reply */}
      <div
        className="flex-1 flex flex-col min-w-0 relative"
        onDragEnter={(e) => {
          if (!active || !dragHasFiles(e.dataTransfer)) return
          e.preventDefault()
          dragDepth.current += 1
          setDropActive(true)
        }}
        onDragOver={(e) => {
          if (!active || !dragHasFiles(e.dataTransfer)) return
          e.preventDefault()
          e.dataTransfer.dropEffect = "copy"
        }}
        onDragLeave={() => {
          dragDepth.current = Math.max(0, dragDepth.current - 1)
          if (dragDepth.current === 0) setDropActive(false)
        }}
        onDrop={async (e) => {
          if (!active || !dragHasFiles(e.dataTransfer)) return
          e.preventDefault()
          dragDepth.current = 0
          setDropActive(false)
          const dropped = await collectDroppedFiles(e.dataTransfer)
          attachFiles(dropped.map((d) => d.file))
        }}
      >
        {dropActive && active && (
          <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none" style={{ background: "rgba(27,45,69,0.10)" }}>
            <div className="rounded-2xl border-2 border-dashed bg-white/95 px-8 py-6 text-center shadow-sm" style={{ borderColor: "#1B2D45" }}>
              <div className="text-3xl mb-1">📎</div>
              <p className="text-sm font-semibold text-gray-900">Drop to attach to {active.name}</p>
              <p className="text-xs text-gray-500 mt-0.5">You can drop several files at once — they send with your next message.</p>
            </div>
          </div>
        )}
        {!active ? (
          <div className="flex-1 flex items-center justify-center text-sm text-gray-400">Select a conversation to read and reply.</div>
        ) : (
          <>
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
              <div>
                <div className="serif text-base font-semibold text-gray-900">{active.name}</div>
                <div className="text-xs text-gray-400">{active.email}</div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={toggleWatch}
                  title={watchOn ? `Reply alerts go to ${watchPhone}` : "Text my cell when this client replies in the portal"}
                  className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${watchOn ? "bg-green-100 border-green-300 text-green-800 font-semibold" : "border-gray-300 text-gray-500 hover:bg-gray-50"}`}
                >
                  📱 Text me on reply: {watchOn ? "ON" : "off"}
                </button>
                <button
                  onClick={copyConversation}
                  title="Copy the whole thread with its formatting intact, ready to paste into Word"
                  className="text-xs text-blue-600 hover:underline"
                >
                  {copied ? "Copied ✓" : "Copy"}
                </button>
                <button onClick={exportTxt} className="text-xs text-blue-600 hover:underline">Export</button>
                <a href={`/admin/messages/print/${active.id}`} target="_blank" rel="noreferrer" className="text-xs text-blue-600 hover:underline">Print / PDF</a>
              </div>
            </div>

            <div ref={threadRef} className="flex-1 overflow-auto px-4 py-4 space-y-3" style={{ background: "#FBF8F3" }}>
              {messages.map((m) => {
                const day = dayLabel(m.created_at)
                const showDay = day !== lastDay
                lastDay = day
                const firm = m.sender === "firm"
                return (
                  <div key={m.id}>
                    {showDay && <div className="text-center my-3"><span className="text-[10px] uppercase tracking-wider text-gray-400">{day}</span></div>}
                    <div className={`flex ${firm ? "justify-end" : "justify-start"}`}>
                      {/* firm bubbles: navy = portal only; lighter blue = also sent via text */}
                      <div className={`max-w-[75%] rounded-2xl px-3.5 py-2 text-sm ${firm ? "text-white" : "text-gray-800 bg-white border border-gray-200"}`} style={firm ? { background: m.sms_status === "full" ? "#4F86D6" : "#1B2D45" } : undefined}>
                        <MessageBody body={m.body} />
                        {m.files?.map((f) => (
                          <a key={f.id} href={`/api/message-files/${f.id}`} target="_blank" rel="noreferrer" className={`block text-xs mt-1 underline ${firm ? "text-white/90" : "text-blue-600"}`}>📎 {f.file_name}</a>
                        ))}
                        <p className={`text-[10px] mt-1 ${firm ? "text-white/60" : "text-gray-400"}`}>
                          {timeOf(m.created_at)}
                          {firm && (
                            <span className="ml-1.5">
                              {m.sms_status === "full" ? "· 💬 portal + 📱 texted" : m.sms_status === "notification" ? "· 💬 portal + 📱 text alert" : "· 💬 portal"}
                              {m.email_status === "notification" && " + 📧 emailed"}
                            </span>
                          )}
                          {!firm && m.sms_status === "inbound" && <span className="ml-1.5">· 📱 received as text</span>}
                        </p>
                      </div>
                    </div>
                  </div>
                )
              })}
              {messages.length === 0 && <p className="text-sm text-gray-400 text-center py-8">No messages yet — start the conversation below.</p>}
            </div>

            <div className="border-t border-gray-200 p-3 bg-white">
              {pendingFiles.length > 0 && (
                <div className="mb-2">
                  <div className="flex items-center justify-between gap-3 mb-1">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                      {pendingFiles.length} {pendingFiles.length === 1 ? "file" : "files"} ready to send
                    </p>
                    <button onClick={() => setPendingFiles([])} className="text-[11px] text-gray-400 hover:text-red-600 underline">Remove all</button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {pendingFiles.map((f, i) => (
                      <span key={`${f.name}-${i}`} className="inline-flex items-center gap-1 text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded-full">
                        📎 {f.name}
                        <button onClick={() => setPendingFiles((p) => p.filter((_, j) => j !== i))} className="text-gray-400 hover:text-red-600">✕</button>
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {fileNotice && <p className="mb-2 text-xs text-amber-700">{fileNotice}</p>}
              {sendError && (
                <div className="mb-2 flex items-center justify-between gap-3 rounded-lg border border-red-300 bg-red-50 px-3 py-2">
                  <p className="text-xs text-red-800">{sendError}</p>
                  <button type="button" onClick={send} disabled={sending} className="text-xs font-semibold text-red-800 underline disabled:opacity-50">Try again</button>
                </div>
              )}
              <div className="flex items-end gap-2">
                <button type="button" onClick={() => fileRef.current?.click()} title="Attach files — or drag them onto the conversation" className="px-2 py-2 text-gray-500 hover:text-gray-800 text-lg">📎</button>
                <input ref={fileRef} type="file" multiple className="hidden" onChange={(e) => { attachFiles(Array.from(e.target.files ?? [])); e.target.value = "" }} />
                {rich ? (
                  <div className="flex-1 min-w-0">
                    <RichTextEditor value={body} onChange={setBody} />
                  </div>
                ) : (
                  <textarea value={body} onChange={(e) => setBody(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send() } }} rows={1} placeholder="Send a message… or drag files here to attach" className="flex-1 resize-none px-3 py-2 text-sm border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 max-h-32" />
                )}
                <button onClick={send} disabled={(composerEmpty && pendingFiles.length === 0) || sending} className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 disabled:opacity-50 self-end">{sending ? "…" : "Send"}</button>
              </div>
              <div className="min-h-[1rem]">
                {attachProgress && <p className="text-xs text-gray-500 mt-1">{attachProgress}</p>}
              </div>
              <div className="flex items-center justify-between gap-3 mt-1.5">
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer select-none" title="Sends the message body as an SMS (requires SMS Reminders checked on the Clients board)">
                    <input type="checkbox" checked={alsoText} onChange={(e) => setAlsoText(e.target.checked)} className="h-3.5 w-3.5 rounded border-gray-300" />
                    📱 Also send this message as a text
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      // Carry the draft across: plain → HTML keeps the line
                      // breaks, HTML → plain flattens the formatting.
                      setBody((b) => (b ? (rich ? bodyToPlainText(b) : bodyToHtml(b)) : b))
                      setRich((r) => !r)
                    }}
                    title={rich ? "Back to the quick one-line composer" : "Bold, italics, lists and links"}
                    className={`text-xs px-2 py-0.5 rounded border transition-colors ${rich ? "bg-blue-50 border-blue-300 text-blue-700 font-semibold" : "border-gray-300 text-gray-500 hover:bg-gray-50"}`}
                  >
                    Aa Formatting: {rich ? "ON" : "off"}
                  </button>
                  {rich && <span className="text-[11px] text-gray-400">Texts are sent as plain text</span>}
                </div>
                {smsNotice && <span className={`text-xs ${smsNotice.includes("not sent") ? "text-amber-700" : "text-green-700"}`}>{smsNotice}</span>}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
