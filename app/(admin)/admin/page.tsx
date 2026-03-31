// app/(admin)/admin/page.tsx
import { sql } from "@/lib/db"
import Link from "next/link"

interface ClientSummary {
  client_id: string
  unread_chat: number
  unread_messages: number
}

export default async function AdminPage() {
  const result = await sql`
    SELECT
      client_id,
      COUNT(*) FILTER (WHERE sender = 'client' AND read = false) AS unread_chat,
      0 AS unread_messages
    FROM chat_messages
    GROUP BY client_id
    UNION ALL
    SELECT
      client_id,
      0 AS unread_chat,
      COUNT(*) FILTER (WHERE read = false) AS unread_messages
    FROM messages
    GROUP BY client_id
  `

  const clientMap = new Map<string, { unread_chat: number; unread_messages: number }>()
  for (const row of result.rows) {
    const existing = clientMap.get(row.client_id) ?? { unread_chat: 0, unread_messages: 0 }
    clientMap.set(row.client_id, {
      unread_chat: existing.unread_chat + parseInt(row.unread_chat ?? "0"),
      unread_messages: existing.unread_messages + parseInt(row.unread_messages ?? "0"),
    })
  }

  const clients: ClientSummary[] = Array.from(clientMap.entries()).map(([client_id, counts]) => ({
    client_id,
    ...counts,
  }))

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Clients</h1>
      {clients.length === 0 ? (
        <p className="text-gray-500">No client activity yet.</p>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
          {clients.map((c) => (
            <div key={c.client_id} className="flex items-center justify-between px-6 py-4">
              <span className="text-sm font-medium text-gray-900">{c.client_id}</span>
              <div className="flex items-center gap-4">
                {c.unread_chat > 0 && (
                  <span className="text-xs bg-blue-100 text-blue-700 px-2.5 py-1 rounded-full font-medium">
                    {c.unread_chat} unread chat
                  </span>
                )}
                <Link
                  href={`/admin/chat/${c.client_id}`}
                  className="text-sm text-blue-600 hover:underline"
                >
                  Chat →
                </Link>
                <Link
                  href={`/admin/messages/${c.client_id}`}
                  className="text-sm text-blue-600 hover:underline"
                >
                  Message →
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
