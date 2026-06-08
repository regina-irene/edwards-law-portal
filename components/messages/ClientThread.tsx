"use client"

import { useState, useEffect, useRef, useCallback } from "react"

interface Msg { id: string; sender: "client" | "firm"; body: string; created_at: string; files?: { id: string; file_name: string }[] }

function timeOf(d: string) { return new Date(d).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) }
function dayLabel(d: string) { return new Date(d).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }) }

export default function ClientThread() {
  const [messages, setMessages] = useState<Msg[]>([])
  const [body, setBody] = useState("")
  const [sending, setSending] = useState(false)
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const ref = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    const r = await fetch("/api/chat")
    if (r.ok) setMessages((await r.json()).messages ?? [])
  }, [])

  useEffect(() => {
    load()
    const t = setInterval(load, 30_000)
    return () => clearInterval(t)
  }, [load])

  useEffect(() => { if (ref.current) ref.current.scrollTop = ref.current.scrollHeight }, [messages])

  async function send() {
    if (!body.trim() && pendingFiles.length === 0) return
    setSending(true)
    const res = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ body: body.trim() || "📎 Attachment" }) })
    if (res.ok) {
      const d = await res.json()
      for (const f of pendingFiles) {
        const fd = new FormData()
        fd.append("file", f)
        fd.append("messageId", d.message.id)
        await fetch("/api/message-files", { method: "POST", body: fd })
      }
      setBody("")
      setPendingFiles([])
      await load()
    }
    setSending(false)
  }

  let lastDay = ""
  return (
    <div className="flex flex-col rounded-xl border border-gray-200 bg-white overflow-hidden" style={{ height: "calc(100vh - 16rem)" }}>
      <div ref={ref} className="flex-1 overflow-auto px-4 py-4 space-y-3" style={{ background: "#FBF8F3" }}>
        {messages.map((m) => {
          const day = dayLabel(m.created_at)
          const showDay = day !== lastDay
          lastDay = day
          const mine = m.sender === "client"
          return (
            <div key={m.id}>
              {showDay && <div className="text-center my-3"><span className="text-[10px] uppercase tracking-wider text-gray-400">{day}</span></div>}
              <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[78%] rounded-2xl px-3.5 py-2 text-sm ${mine ? "text-white" : "text-gray-800 bg-white border border-gray-200"}`} style={mine ? { background: "#1B2D45" } : undefined}>
                  <p className="whitespace-pre-wrap break-words">{m.body}</p>
                  {m.files?.map((f) => (
                    <a key={f.id} href={`/api/message-files/${f.id}`} target="_blank" rel="noreferrer" className={`block text-xs mt-1 underline ${mine ? "text-white/90" : "text-blue-600"}`}>📎 {f.file_name}</a>
                  ))}
                  <p className={`text-[10px] mt-1 ${mine ? "text-white/60" : "text-gray-400"}`}>{timeOf(m.created_at)}</p>
                </div>
              </div>
            </div>
          )
        })}
        {messages.length === 0 && <p className="text-sm text-gray-400 text-center py-10">No messages yet. Send a message to your legal team below.</p>}
      </div>
      <div className="border-t border-gray-200 p-3 bg-white">
        {pendingFiles.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2">
            {pendingFiles.map((f, i) => (
              <span key={i} className="inline-flex items-center gap-1 text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded-full">📎 {f.name}<button onClick={() => setPendingFiles((p) => p.filter((_, j) => j !== i))} className="text-gray-400 hover:text-red-600">✕</button></span>
            ))}
          </div>
        )}
        <div className="flex items-end gap-2">
          <button type="button" onClick={() => fileRef.current?.click()} title="Attach files" className="px-2 py-2 text-gray-500 hover:text-gray-800 text-lg">📎</button>
          <input ref={fileRef} type="file" multiple className="hidden" onChange={(e) => { const fs = Array.from(e.target.files ?? []); if (fs.length) setPendingFiles((p) => [...p, ...fs]); e.target.value = "" }} />
          <textarea value={body} onChange={(e) => setBody(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send() } }} rows={1} placeholder="Send a message to your legal team…" className="flex-1 resize-none px-3 py-2 text-sm border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 max-h-32" />
          <button onClick={send} disabled={(!body.trim() && pendingFiles.length === 0) || sending} className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 disabled:opacity-50">{sending ? "…" : "Send"}</button>
        </div>
      </div>
    </div>
  )
}
