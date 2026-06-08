"use client"

import { useEffect, useState, use } from "react"

interface Msg { id: string; sender: "client" | "firm"; body: string; created_at: string }

export default function PrintThread({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = use(params)
  const [messages, setMessages] = useState<Msg[]>([])
  const [ready, setReady] = useState(false)

  useEffect(() => {
    fetch(`/api/admin/chat?clientId=${encodeURIComponent(clientId)}`)
      .then((r) => r.json())
      .then((d) => setMessages(d.messages ?? []))
      .finally(() => setReady(true))
  }, [clientId])

  useEffect(() => {
    if (ready && messages.length) setTimeout(() => window.print(), 400)
  }, [ready, messages.length])

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: 32, fontFamily: "Georgia, serif", color: "#111" }}>
      <h1 style={{ fontSize: 22, marginBottom: 4 }}>Edwards Family Law — Message Transcript</h1>
      <p style={{ fontSize: 12, color: "#555", marginBottom: 20 }}>Generated {new Date().toLocaleString("en-US")}</p>
      {messages.map((m) => (
        <div key={m.id} style={{ marginBottom: 14, paddingBottom: 14, borderBottom: "1px solid #eee" }}>
          <p style={{ fontSize: 12, color: "#666", marginBottom: 4 }}>
            <strong>{m.sender === "firm" ? "Edwards Family Law" : "Client"}</strong> · {new Date(m.created_at).toLocaleString("en-US")}
          </p>
          <p style={{ fontSize: 14, whiteSpace: "pre-wrap", margin: 0 }}>{m.body}</p>
        </div>
      ))}
      {ready && messages.length === 0 && <p>No messages in this conversation.</p>}
    </div>
  )
}
