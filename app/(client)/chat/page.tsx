// app/(client)/chat/page.tsx
"use client"

import { useState, useEffect, useCallback } from "react"
import ChatThread from "@/components/chat/ChatThread"
import ChatInput from "@/components/chat/ChatInput"

interface ChatMessage {
  id: string
  sender: "client" | "firm"
  body: string
  created_at: string
}

export default function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([])

  const fetchMessages = useCallback(async () => {
    const res = await fetch("/api/chat")
    if (res.ok) {
      const data = await res.json()
      setMessages(data.messages)
    }
  }, [])

  useEffect(() => {
    fetchMessages()
    // Poll every 60 seconds for new messages from firm
    const interval = setInterval(fetchMessages, 60_000)
    return () => clearInterval(interval)
  }, [fetchMessages])

  async function handleSend(body: string) {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body }),
    })
    if (res.ok) {
      const data = await res.json()
      setMessages((prev) => [...prev, data.message])
    } else {
      alert("Failed to send message. Please try again.")
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-4">Chat</h1>
      <div className="flex-1 overflow-y-auto bg-gray-50 rounded-xl border border-gray-200 px-4">
        <ChatThread messages={messages} />
      </div>
      <div className="mt-4">
        <ChatInput onSend={handleSend} />
      </div>
    </div>
  )
}
