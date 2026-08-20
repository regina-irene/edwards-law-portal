"use client"
// components/messages/ClientThread.tsx - the client's two-way conversation with
// the firm: transcript, export buttons and the composer.

import { useState, useEffect, useRef, useCallback } from "react"
import UploadDocsButton from "@/components/messages/UploadDocsButton"
import MessageBody from "@/components/messages/MessageBody"

interface Msg { id: string; sender: "client" | "firm"; body: string; created_at: string; sms_status?: "notification" | "full" | "inbound" | null; files?: { id: string; file_name: string }[] }

function channelOf(m: Msg): string {
  if (m.sender === "firm") {
    return m.sms_status === "full" ? "portal + texted" : m.sms_status === "notification" ? "portal + text alert" : "portal"
  }
  return m.sms_status === "inbound" ? "text message" : "portal"
}

function timeOf(d: string) { return new Date(d).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) }
function dayLabel(d: string) { return new Date(d).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }) }
function stamp(d: string) { return new Date(d).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }) }

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}

// ---- export helpers (PDF via print dialog, Word, Excel, Print) ----

function transcriptHtml(messages: Msg[]): string {
  const rows = messages.map((m) => `
    <div style="margin-bottom:14px;padding-bottom:12px;border-bottom:1px solid #eee">
      <p style="font-size:12px;color:#666;margin:0 0 4px 0">
        <strong>${m.sender === "firm" ? "Edwards Family Law" : "Client"}</strong> · ${esc(stamp(m.created_at))} · via ${esc(channelOf(m))}
      </p>
      <p style="font-size:14px;white-space:pre-wrap;margin:0">${esc(m.body)}</p>
      ${(m.files ?? []).map((f) => `<p style="font-size:12px;color:#444;margin:4px 0 0 0">📎 ${esc(f.file_name)}</p>`).join("")}
    </div>`)
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Message Transcript</title></head>
    <body style="max-width:720px;margin:0 auto;padding:32px;font-family:Georgia,serif;color:#111">
      <h1 style="font-size:22px;margin-bottom:4px">Edwards Family Law - Message Transcript</h1>
      <p style="font-size:12px;color:#555;margin-bottom:20px">Generated ${esc(new Date().toLocaleString("en-US"))}</p>
      ${rows.join("")}
    </body></html>`
}

function downloadBlob(content: string, mime: string, filename: string) {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

// Print and PDF both open the print dialog (choose "Save as PDF" for a file)
function printTranscript(messages: Msg[]) {
  const w = window.open("", "_blank")
  if (!w) return
  w.document.write(transcriptHtml(messages))
  w.document.close()
  w.focus()
  setTimeout(() => w.print(), 300)
}

function exportWord(messages: Msg[]) {
  downloadBlob(transcriptHtml(messages), "application/msword", "messages.doc")
}

function exportExcel(messages: Msg[]) {
  const rows = messages.map((m) => `
    <tr>
      <td>${esc(stamp(m.created_at))}</td>
      <td>${m.sender === "firm" ? "Edwards Family Law" : "Client"}</td>
      <td>${esc(channelOf(m))}</td>
      <td>${esc(m.body)}</td>
      <td>${esc((m.files ?? []).map((f) => f.file_name).join(", "))}</td>
    </tr>`)
  const table = `<html xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8"></head><body>
    <table border="1"><tr><th>Date</th><th>From</th><th>Sent Via</th><th>Message</th><th>Attachments</th></tr>${rows.join("")}</table>
  </body></html>`
  downloadBlob(table, "application/vnd.ms-excel", "messages.xls")
}

function ExportButtons({ messages }: { messages: Msg[] }) {
  const cls = "text-[11px] font-medium px-2 py-1 rounded-full border border-gray-300 text-gray-600 hover:bg-gray-100 transition-colors"
  if (messages.length === 0) return null
  return (
    <span className="inline-flex items-center gap-1.5 flex-wrap">
      <span className="text-[11px] text-gray-400">Export:</span>
      <button type="button" className={cls} onClick={() => printTranscript(messages)} title="In the print window, choose Save as PDF">PDF</button>
      <button type="button" className={cls} onClick={() => exportWord(messages)}>Word</button>
      <button type="button" className={cls} onClick={() => exportExcel(messages)}>Excel</button>
      <button type="button" className={cls} onClick={() => printTranscript(messages)}>🖨️ Print</button>
    </span>
  )
}

// `readOnly` comes from the server page (the client's case is closed and they
// are inside the 30-day wind-down). The transcript and the export buttons stay
// exactly as they were - only the ways of adding to the thread go away.
export default function ClientThread({ readOnly = false }: { readOnly?: boolean } = {}) {
  const [messages, setMessages] = useState<Msg[]>([])
  const [body, setBody] = useState("")
  const [sending, setSending] = useState(false)
  // A failed load must never render as "No messages yet" - that tells a client
  // their attorney hasn't written, which may be false. (2026-08-18)
  const [loadFailed, setLoadFailed] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [sendError, setSendError] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/chat")
      if (!r.ok) throw new Error(String(r.status))
      setMessages((await r.json()).messages ?? [])
      setLoadFailed(false)
    } catch {
      setLoadFailed(true)
    } finally {
      setLoaded(true)
    }
  }, [])

  useEffect(() => {
    load()
    // Pause polling while the tab is hidden - it was polling forever in the
    // background, and each poll costs a round trip.
    const t = setInterval(() => {
      if (document.visibilityState === "visible") load()
    }, 30_000)
    return () => clearInterval(t)
  }, [load])

  useEffect(() => { if (ref.current) ref.current.scrollTop = ref.current.scrollHeight }, [messages])

  async function send() {
    if (!body.trim()) return
    setSending(true)
    setSendError(false)
    const res = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ body: body.trim() }) }).catch(() => null)
    if (res?.ok) {
      setBody("")
      await load()
    } else {
      // Keep the draft and say so. Silently doing nothing leaves the client
      // unsure whether their attorney received the message.
      setSendError(true)
    }
    setSending(false)
  }

  const sendFilesButton = readOnly ? null : (
    <UploadDocsButton
      label="📎 Send files"
      heading="Send documents to your legal team"
      blurb="Drag and drop files here, or browse. They go straight to your legal team."
      actionLabel="Send to firm"
      buttonClassName="px-5 py-2 text-sm rounded-xl bg-[#EA580C] hover:bg-[#C2410C] text-white font-semibold whitespace-nowrap shadow-sm transition-colors"
    />
  )

  let lastDay = ""
  return (
    // `dvh` rather than `vh` so the height accounts for the phone browser's own
    // chrome, and a smaller subtraction on phones so the composer lands just
    // above the bottom tab bar instead of below the fold. At `md` and up this
    // is the old calc(100vh - 18rem); dvh and vh are the same on desktop.
    <div className="flex flex-col rounded-xl border border-gray-200 bg-white overflow-hidden h-[calc(100dvh-14rem)] min-h-[20rem] md:h-[calc(100dvh-18rem)] md:min-h-0">
      <div className="border-b border-gray-200 bg-white px-4 py-2.5 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          {readOnly ? (
            <span className="text-sm text-gray-500">
              Sending files is turned off because your case is closed. Everything you sent before is still here.
            </span>
          ) : (
            <>
              <span className="text-sm text-gray-500">Have documents for your legal team?</span>
              {sendFilesButton}
            </>
          )}
        </div>
        <ExportButtons messages={messages} />
      </div>
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
                  <MessageBody body={m.body} />
                  {m.files?.map((f) => (
                    <a key={f.id} href={`/api/message-files/${f.id}`} target="_blank" rel="noreferrer" className={`block text-xs mt-1 underline ${mine ? "text-white/90" : "text-blue-600"}`}>📎 {f.file_name}</a>
                  ))}
                  <p className={`text-[10px] mt-1 ${mine ? "text-white/60" : "text-gray-400"}`}>{timeOf(m.created_at)}</p>
                </div>
              </div>
            </div>
          )
        })}
        {loadFailed && messages.length === 0 && (
          <div className="text-center py-10 px-4">
            <p className="text-sm text-gray-700">We couldn&apos;t load your messages just now.</p>
            <p className="text-xs text-gray-500 mt-1">This is a connection problem, not a sign that your messages are gone.</p>
            <button type="button" onClick={load} className="mt-3 px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 bg-white hover:border-gray-500">Try again</button>
          </div>
        )}
        {loaded && !loadFailed && messages.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-10">
            {readOnly ? "There are no messages in this conversation." : "No messages yet. Send a message to your legal team below."}
          </p>
        )}
      </div>
      <div className="border-t border-gray-200 p-3 bg-white">
        {readOnly ? (
          <p className="text-sm text-gray-600 text-center py-1">
            Your case is closed, so new messages are turned off. You can still read and save this
            whole conversation above. If you need anything, please contact the office.
          </p>
        ) : (
          <>
        {sendError && (
          <div className="mb-2 flex items-center justify-between gap-3 rounded-lg border border-red-300 bg-red-50 px-3 py-2">
            <p className="text-xs text-red-800">Your message wasn&apos;t sent. It&apos;s still here - check your connection and try again.</p>
            <button type="button" onClick={send} disabled={sending} className="text-xs font-semibold text-red-800 underline disabled:opacity-50">Try again</button>
          </div>
        )}
        <div className="flex items-end gap-2">
          {sendFilesButton}
          <textarea value={body} onChange={(e) => setBody(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send() } }} rows={1} placeholder="Send a message to your legal team…" className="flex-1 resize-none px-3 py-2 text-sm text-gray-900 bg-white border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 max-h-32" />
          <button onClick={send} disabled={!body.trim() || sending} className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 disabled:opacity-50">{sending ? "…" : "Send"}</button>
        </div>
          </>
        )}
      </div>
    </div>
  )
}
