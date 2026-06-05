// app/(admin)/admin/page.tsx
import { sql } from "@/lib/db"
import { getAllClients } from "@/lib/airtable"
import { revalidatePath } from "next/cache"
import Link from "next/link"

async function refreshClients() {
  "use server"
  revalidatePath("/admin")
}

export default async function AdminPage() {
  const [clientsUnsorted, activityResult] = await Promise.all([
    getAllClients(),
    sql`
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
    `.catch(() => ({ rows: [] as any[] })),
  ])

  const clients = [...clientsUnsorted].sort((a, b) =>
    (a.name || a.clientId).localeCompare(b.name || b.clientId, undefined, { sensitivity: "base" })
  )

  const activityMap = new Map<string, { unread_chat: number; unread_messages: number }>()
  for (const row of activityResult.rows) {
    const existing = activityMap.get(row.client_id) ?? { unread_chat: 0, unread_messages: 0 }
    activityMap.set(row.client_id, {
      unread_chat: existing.unread_chat + parseInt(row.unread_chat ?? "0"),
      unread_messages: existing.unread_messages + parseInt(row.unread_messages ?? "0"),
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-2xl font-bold text-gray-900">Clients</h1>
        <form action={refreshClients}>
          <button
            type="submit"
            className="text-sm bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700"
          >
            Refresh from Airtable
          </button>
        </form>
      </div>
      {clients.length === 0 ? (
        <p className="text-gray-500">No clients found in Airtable.</p>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
          {clients.map((c) => {
            const activity = activityMap.get(c.clientId) ?? { unread_chat: 0, unread_messages: 0 }
            return (
              <div key={c.clientId} className="flex items-center justify-between px-6 py-4 flex-wrap gap-3">
                <div>
                  <p className="text-sm font-medium text-gray-900">{c.name || c.clientId}</p>
                  <p className="text-xs text-gray-400">{c.email} · ID: {c.clientId}</p>
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                  {activity.unread_chat > 0 && (
                    <span className="text-xs bg-blue-100 text-blue-700 px-2.5 py-1 rounded-full font-medium">
                      {activity.unread_chat} unread chat
                    </span>
                  )}
                  <Link href={`/admin/chat/${c.clientId}`} className="text-sm text-blue-600 hover:underline">Chat</Link>
                  <Link href={`/admin/messages/${c.clientId}`} className="text-sm text-blue-600 hover:underline">Message</Link>
                  <Link href={`/admin/clients/${c.clientId}/pages`} className="text-sm text-blue-600 hover:underline">Pages</Link>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
