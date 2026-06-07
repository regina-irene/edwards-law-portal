// app/(client)/messages/page.tsx
import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { getPortalClient } from "@/lib/portal-client"
import { sql } from "@/lib/db"
import PageHeader from "@/components/ui/PageHeader"
import { getPageContent } from "@/lib/page-content"

interface Message {
  id: string
  body: string
  created_at: string
}

function formatDateTime(ts: string): string {
  return new Date(ts).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

export default async function MessagesPage() {
  const session = await auth()
  if (!session?.user?.email) redirect("/login")

  const client = await getPortalClient()
  if (!client) redirect("/login")

  const pageContent = await getPageContent(client.clientId, "messages")

  // Mark unread as read
  await sql`
    UPDATE messages SET read = true
    WHERE client_id = ${client.clientId} AND read = false
  `

  const result = await sql`
    SELECT id, body, created_at
    FROM messages
    WHERE client_id = ${client.clientId}
    ORDER BY created_at DESC
    LIMIT 50
  `

  const messages = result.rows as Message[]

  return (
    <div className="space-y-6 max-w-2xl">
      <PageHeader defaultTitle="Messages" page="messages" content={pageContent} />
      {messages.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <p>No messages yet.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {messages.map((msg) => (
            <div key={msg.id} className="bg-white rounded-lg border border-gray-200 p-5 shadow-sm">
              <p className="text-gray-800 whitespace-pre-wrap">{msg.body}</p>
              <p className="mt-3 text-xs text-gray-400">{formatDateTime(msg.created_at)}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
