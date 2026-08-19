"use client"
// components/admin/InviteButton.tsx - per-client "Send invite" on the admin
// client list: emails the welcome/login instructions via Resend.
// Rendered as a big icon with a label underneath (client-list action style).

import { useState } from "react"
import { ConfirmDialog } from "@/components/ui/ConfirmDialog"
import {
  CLIENT_ACTION_CLS,
  CLIENT_ACTION_ICON_CLS,
  CLIENT_ACTION_LABEL_CLS,
} from "@/components/admin/client-action-style"

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
        className={CLIENT_ACTION_CLS}
      >
        <span className={CLIENT_ACTION_ICON_CLS}>{status === "sent" ? "✅" : "✉️"}</span>
        <span className={status === "error" ? "text-[11px] font-medium text-red-600" : CLIENT_ACTION_LABEL_CLS}>
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
