"use client"

import { useState, use } from "react"

export default function AdminMessagesPage({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = use(params)
  const [body, setBody] = useState("")
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle")

  async function handleSend() {
    if (!body.trim()) return
    setStatus("sending")
    const res = await fetch("/api/admin/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId, body }),
    })
    if (res.ok) {
      setBody("")
      setStatus("sent")
      setTimeout(() => setStatus("idle"), 3000)
    } else {
      setStatus("error")
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">
        Send Message — <span className="text-gray-500 font-normal">{clientId}</span>
      </h1>
      <p className="text-sm text-gray-500">
        This message will appear in the client&apos;s Messages inbox in the portal.
      </p>

      <div className="space-y-4">
        <textarea
          value={body}
          onChange={(e) => {
            setBody(e.target.value)
            if (status === "error") setStatus("idle")
          }}
          placeholder="Write your message to the client..."
          rows={6}
          className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
        />
        <div className="flex items-center gap-4">
          <button
            onClick={handleSend}
            disabled={!body.trim() || status === "sending"}
            className="px-6 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {status === "sending" ? "Sending..." : "Send Message"}
          </button>
          {status === "sent" && (
            <span className="text-sm text-green-600 font-medium">Message sent.</span>
          )}
          {status === "error" && (
            <span className="text-sm text-red-600">Failed to send. Try again.</span>
          )}
        </div>
      </div>
    </div>
  )
}
