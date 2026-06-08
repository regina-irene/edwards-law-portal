"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useSearchParams } from "next/navigation"

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
  const threadRef = useRef<HTMLDivElement>(null)

  const loadConvos = useCallback(async () => {
    const r = await fetch("/api/admin/conversations")
    if (r.ok) setConvos((await r.json()).conversations ?? [])
  }, [])

  useEffect(() => { loadConvos() }, [loadConvos])

  // Preselect from ?c=
  useEffect(() => {
    const c = params.get("c")
    if (c) setSelected(c)
  }, [params])

  const loadThread = useCallback(async (id: string) => {
    const r = await fetch(`/api/admin/chat?clientId=${encodeURIComponent(id)}`)
    if (r.ok) {
      setMessages((await r.json()).messages ?? [])
      loadConvos() // refresh unread after marking read
    }
  }, [loadConvos])

  useEffect(() => {
    if (selected) loadThread(selected)
  }, [selected, loadThread])

  useEffect(() => {
    if (threadRef.current) threadRef.current.scrollTop = threadRef.current.scrollHeight
  }, [messages])

  async function send() {
    if (!body.trim() || !selected) return
    setSending(true)
    const res = await fetch("/api/admin/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId: selected, body: body.trim() }),
    })
    setSending(false)
    if (res.ok) {
      const d = await res.json()
      setMessages((prev) => [...prev, d.message])
      setBody("")
      loadConvos()
    }
  }

  function exportTxt() {
    const conv = convos.find((c) => c.id === selected)
    const lines = messages.map((m) => `[${new Date(m.created_at).toLocaleString("en-US")}] ${m.sender === "firm" ? "Firm" : conv?.name ?? "Client"}: ${m.body}`)
    const blob = new Blob([`Conversation with ${conv?.name ?? ""}\n\n${lines.join("\n")}`], { type: "text/plain" })
    const a = document.createElement("a")
    a.href = URL.createObjectURL(blob)
    a.download = `messages-${(conv?.name ?? "client").replace(/[^\w]+/g, "-")}.txt`
    a.click()
  }

  const q = search.trim().toLowerCase()
  const filtered = q ? convos.filter((c) => c.name.toLowerCase().includes(q) || c.preview.toLowerCase().includes(q) || c.email.toLowerCase().includes(q)) : convos
  const active = convos.find((c) => c.id === selected)

  let lastDay = ""

  return (
    <div className="flex h-[calc(100vh-7.5rem)] rounded-xl border border-gray-200 overflow-hidden bg-white">
      {/* Conversation list */}
      <div className="w-80 shrink-0 border-r border-gray-200 flex flex-col" style={{ background: "#FBF8F3" }}>
        <div className="p-3 border-b border-gray-200">
          <h1 className="serif text-lg font-semibold text-gray-900 mb-2">Messages</h1>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search messages…" className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div className="flex-1 overflow-auto">
          {filtered.map((c) => (
            <button key={c.id} onClick={() => setSelected(c.id)} className={`w-full text-left flex gap-3 px-3 py-3 border-b border-gray-100 transition-colors ${selected === c.id ? "bg-[#efe7da]" : "hover:bg-[#f3ede4]"}`} style={{ borderLeft: `3px solid ${selected === c.id ? "#1B2D45" : "transparent"}` }}>
              <span className="w-9 h-9 rounded-full flex items-center justify-center text-[11px] font-semibold shrink-0" style={{ background: "#1B2D45", color: "#fff" }}>{initials(c.name)}</span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-gray-900 truncate">{c.name}</span>
                  <span className="text-[10px] text-gray-400 shrink-0">{c.lastAt ? relDay(c.lastAt) : ""}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-gray-500 truncate">{c.preview || "No messages yet"}</span>
                  {c.unread > 0 && <span className="shrink-0 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">{c.unread}</span>}
                </div>
              </div>
            </button>
          ))}
          {filtered.length === 0 && <p className="text-sm text-gray-400 text-center py-8">No conversations.</p>}
        </div>
      </div>

      {/* Thread */}
      <div className="flex-1 flex flex-col min-w-0">
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
                      <div className={`max-w-[75%] rounded-2xl px-3.5 py-2 text-sm ${firm ? "text-white" : "text-gray-800 bg-white border border-gray-200"}`} style={firm ? { background: "#1B2D45" } : undefined}>
                        <p className="whitespace-pre-wrap break-words">{m.body}</p>
                        <p className={`text-[10px] mt-1 ${firm ? "text-white/60" : "text-gray-400"}`}>{timeOf(m.created_at)}</p>
                      </div>
                    </div>
                  </div>
                )
              })}
              {messages.length === 0 && <p className="text-sm text-gray-400 text-center py-8">No messages yet — start the conversation below.</p>}
            </div>

            <div className="border-t border-gray-200 p-3 flex items-end gap-2 bg-white">
              <textarea value={body} onChange={(e) => setBody(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send() } }} rows={1} placeholder="Send a message…" className="flex-1 resize-none px-3 py-2 text-sm border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 max-h-32" />
              <button onClick={send} disabled={!body.trim() || sending} className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 disabled:opacity-50">{sending ? "…" : "Send"}</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
