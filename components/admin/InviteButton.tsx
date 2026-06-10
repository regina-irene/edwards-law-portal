"use client"
// components/admin/InviteButton.tsx — per-client "Send invite" on the admin
// client list: emails the welcome/login instructions via Resend.

import { useState } from "react"

type Status = "idle" | "sending" | "sent" | "error"

export default function InviteButton({ email, firstName }: { email: string; firstName: string }) {
  const [status, setStatus] = useState<Status>("idle")

  async function send() {
    if (status === "sending") return
    if (!confirm(`Email portal login instructions to ${email}?`)) return
    setStatus("sending")
    const res = await fetch("/api/admin/send-invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, firstName }),
    })
    setStatus(res.ok ? "sent" : "error")
  }

  if (!email) return null
  if (status === "sent") return <span className="text-sm text-green-700 font-medium">Invite sent ✓</span>
  return (
    <button
      type="button"
      onClick={send}
      disabled={status === "sending"}
      className="text-sm text-blue-600 hover:underline disabled:opacity-60"
    >
      {status === "sending" ? "Sending…" : status === "error" ? "Failed — retry?" : "Send invite"}
    </button>
  )
}
