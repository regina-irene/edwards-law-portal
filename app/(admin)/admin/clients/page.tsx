// app/(admin)/admin/clients/page.tsx
import { sql } from "@/lib/db"
import { clientDisplayLabel, fetchAllClientsRaw } from "@/lib/airtable"
import { getClientLabels } from "@/lib/client-labels"
import { refreshClients } from "../actions"
import { startPreview } from "@/app/preview-actions"
import ClientLabelEditor from "../ClientLabelEditor"
import RefreshButton from "../RefreshButton"
import Link from "next/link"

function formatRefreshed(ms: number): string {
  return new Date(ms).toLocaleString("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    timeZoneName: "short",
  })
}

export default async function ClientsPage() {
  const [clientsRaw, labels, activityResult] = await Promise.all([
    fetchAllClientsRaw(),
    getClientLabels(),
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

  const fetchedAt = Date.now()

  const clients = clientsRaw
    .map((c) => {
      const id = String(c.clientId)
      return { ...c, id, label: labels[id] || clientDisplayLabel(c.name) }
    })
    .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: "base" }))

  const refreshedAt = formatRefreshed(fetchedAt)

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
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <h1 className="text-2xl font-bold text-gray-900">Clients</h1>
        <form action={refreshClients}>
          <RefreshButton />
          <span className="block text-right text-xs text-gray-400 mt-1">Last refreshed {refreshedAt}</span>
        </form>
      </div>
      {clients.length === 0 ? (
        <p className="text-gray-500">No clients found in Airtable.</p>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
          {clients.map((c) => {
            const activity = activityMap.get(c.id) ?? { unread_chat: 0, unread_messages: 0 }
            return (
              <div key={c.id} className="flex items-center justify-between px-6 py-4 flex-wrap gap-3">
                <div>
                  <ClientLabelEditor clientId={c.id} label={c.label} />
                  <p className="text-xs text-gray-400">{c.email} · Updated {refreshedAt}</p>
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                  {activity.unread_chat > 0 && (
                    <span className="text-xs bg-blue-100 text-blue-700 px-2.5 py-1 rounded-full font-medium">{activity.unread_chat} unread chat</span>
                  )}
                  <Link href={`/admin/messages?c=${encodeURIComponent(c.id)}`} className="text-sm text-blue-600 hover:underline">Messages</Link>
                  <Link href={`/admin/clients/${c.id}/pages`} className="text-sm text-blue-600 hover:underline">Pages</Link>
                  <form action={startPreview.bind(null, c.id)}>
                    <button type="submit" className="text-sm text-blue-600 hover:underline">Preview</button>
                  </form>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
