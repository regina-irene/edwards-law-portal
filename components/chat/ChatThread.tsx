// components/chat/ChatThread.tsx
"use client"

import { useEffect, useRef } from "react"

interface ChatMessage {
  id: string
  sender: "client" | "firm"
  body: string
  created_at: string
}

interface ChatThreadProps {
  messages: ChatMessage[]
}

function formatTime(ts: string): string {
  return new Date(ts).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
}

export default function ChatThread({ messages }: ChatThreadProps) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  return (
    <div className="flex flex-col gap-4 py-4">
      {messages.length === 0 && (
        <p className="text-center text-sm text-gray-400 py-8">No messages yet. Say hello!</p>
      )}
      {messages.map((msg) => (
        <div
          key={msg.id}
          className={`flex ${msg.sender === "client" ? "justify-end" : "justify-start"}`}
        >
          <div
            className={`max-w-sm px-4 py-2.5 rounded-2xl text-sm ${
              msg.sender === "client"
                ? "bg-blue-600 text-white rounded-br-sm"
                : "bg-white border border-gray-200 text-gray-900 rounded-bl-sm"
            }`}
          >
            <p className="whitespace-pre-wrap">{msg.body}</p>
            <p className={`text-xs mt-1 ${msg.sender === "client" ? "text-blue-200" : "text-gray-400"}`}>
              {formatTime(msg.created_at)}
            </p>
          </div>
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  )
}
