"use client"

import { useState, useEffect, useCallback, use } from "react"
import ChatThread from "@/components/chat/ChatThread"
import ChatInput from "@/components/chat/ChatInput"

interface ChatMessage {
  id: string
  sender: "client" | "firm"
  body: string
  created_at: string
}

export default function AdminChatPage({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = use(params)
  const [messages, setMessages] = useState<ChatMessage[]>([])

  const fetchMessages = useCallback(async () => {
    const res = await fetch(`/api/admin/chat?clientId=${clientId}`)
    if (res.ok) {
      const data = await res.json()
      setMessages(data.messages)
    }
  }, [clientId])

  useEffect(() => {
    fetchMessages()
    const interval = setInterval(fetchMessages, 30_000)
    return () => clearInterval(interval)
  }, [fetchMessages])

  async function handleSend(body: string) {
    const res = await fetch("/api/admin/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId, body }),
    })
    if (res.ok) {
      const data = await res.json()
      setMessages((prev) => [...prev, data.message])
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-4">
        Chat — <span className="text-gray-500 font-normal">{clientId}</span>
      </h1>
      <div className="flex-1 overflow-y-auto bg-gray-50 rounded-xl border border-gray-200 px-4">
        <ChatThread messages={messages} />
      </div>
      <div className="mt-4">
        <ChatInput onSend={handleSend} />
      </div>
    </div>
  )
}
