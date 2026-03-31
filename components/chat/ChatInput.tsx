// components/chat/ChatInput.tsx
"use client"

import { useState, KeyboardEvent } from "react"

interface ChatInputProps {
  onSend: (body: string) => Promise<boolean>
}

export default function ChatInput({ onSend }: ChatInputProps) {
  const [value, setValue] = useState("")
  const [sending, setSending] = useState(false)

  async function handleSend() {
    const trimmed = value.trim()
    if (!trimmed || sending) return
    setSending(true)
    const success = await onSend(trimmed)
    if (success) {
      setValue("")
    }
    setSending(false)
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="flex gap-3 items-end border-t border-gray-200 pt-4">
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Type a message... (Enter to send)"
        rows={2}
        disabled={sending}
        className="flex-1 resize-none px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:bg-gray-50"
      />
      <button
        onClick={handleSend}
        disabled={!value.trim() || sending}
        className="px-5 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
      >
        Send
      </button>
    </div>
  )
}
