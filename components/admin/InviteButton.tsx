"use client"
// components/admin/InviteButton.tsx — per-client "Send invite" on the admin
// client list: emails the welcome/login instructions via Resend.
// Rendered as a big icon with a label underneath (client-list action style).

import { useState } from "react"
import { ConfirmDialog } from "@/components/ui/ConfirmDialog"

type Status = "idle" | "sending" | "sent" | "error"

export default function InviteButton({ email, firstName }: { email: string; firstName: string }) {
  const [status, setStatus] = useState<Status>("idle")
  const [confirming, setConfirming] = useState(false)

  async function send() {
    if (status === "sending") return
    setConfirming(false)
    setStatus("sending")
    const res = await fetch("/api/admin/send-invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, firstName }),
    })
    setStatus(res.ok ? "sent" : "error")
  }

  if (!email) return null
  return (
    <>
      <button
        type="button"
        onClick={() => setConfirming(true)}
        disabled={status === "sending" || status === "sent"}
        title={`Email portal login instructions to ${email}`}
        className="flex flex-col items-center gap-1 px-2 py-1.5 rounded-lg hover:bg-gray-100 transition-colors w-[4.5rem] disabled:opacity-70"
      >
        <span className="text-2xl leading-none">{status === "sent" ? "✅" : "✉️"}</span>
        <span className={`text-[11px] font-medium ${status === "error" ? "text-red-600" : "text-gray-600"}`}>
          {status === "sending" ? "Sending…" : status === "sent" ? "Sent" : status === "error" ? "Retry" : "Invite"}
        </span>
      </button>

      <ConfirmDialog
        open={confirming}
        title="Send the portal invite?"
        body={`We'll email ${email} their login instructions for the portal.`}
        confirmLabel="Send invite"
        onConfirm={send}
        onCancel={() => setConfirming(false)}
      />
    </>
  )
}
