// app/(admin)/admin/page.tsx — admin Home / dashboard with activity
import { sql } from "@/lib/db"
import { fetchAllClientsRaw, clientDisplayLabel } from "@/lib/airtable"
import { getClientLabels } from "@/lib/client-labels"
import { dismissActivity } from "./actions"
import Link from "next/link"

function relTime(d: string | Date): string {
  const diff = Date.now() - new Date(d).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return "just now"
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const days = Math.floor(h / 24)
  if (days < 7) return `${days}d ago`
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

const num = (r: any) => parseInt(r?.rows?.[0]?.count ?? "0", 10) || 0

export default async function AdminHome() {
  const [clients, labels, unreadMessages, pendingTasks, activity] = await Promise.all([
    fetchAllClientsRaw().catch(() => []),
    getClientLabels().catch(() => ({} as Record<string, string>)),
    sql`SELECT COUNT(*) AS count FROM chat_messages WHERE sender='client' AND read=false`.catch(() => ({ rows: [{ count: "0" }] })),
    sql`SELECT COUNT(*) AS count FROM client_tasks WHERE status='pending'`.catch(() => ({ rows: [{ count: "0" }] })),
    sql`
      SELECT * FROM (
        SELECT 'chat' AS kind, id::text AS id, client_id, body AS detail, sender, created_at FROM chat_messages
        UNION ALL SELECT 'message', id::text, client_id, body, 'firm', created_at FROM messages
        UNION ALL SELECT 'upload', id::text, client_id, file_name, 'client', created_at FROM task_attachments WHERE scope='client_task'
        UNION ALL SELECT 'form', id::text, client_id, form_key, 'client', updated_at FROM form_responses
      ) a
      WHERE a.id NOT IN (SELECT event_id FROM dismissed_activity)
      ORDER BY created_at DESC LIMIT 15
    `.catch(() => ({ rows: [] as any[] })),
  ])

  const labelById = new Map(clients.map((c) => [String(c.clientId), labels[String(c.clientId)] || clientDisplayLabel(c.name)]))
  const nameFor = (id: string) => labelById.get(id) || "A client"

  const describe = (a: any): string => {
    if (a.kind === "chat") return a.sender === "firm" ? "— you sent a message" : "sent a message"
    if (a.kind === "message") return "— you sent a message"
    if (a.kind === "upload") return `uploaded ${a.detail}`
    if (a.kind === "form") return `updated the ${String(a.detail).replace(/-/g, " ")} form`
    return "activity"
  }

  // Where clicking an activity row takes you: messages → that conversation;
  // uploads & form updates → that client's record page.
  const hrefFor = (a: any): string => {
    const id = encodeURIComponent(String(a.client_id))
    if (a.kind === "chat" || a.kind === "message") return `/admin/messages?c=${id}`
    return `/admin/clients/${id}/pages`
  }

  const stats = [
    { label: "Clients", value: clients.length, href: "/admin/clients" },
    { label: "Unread messages", value: num(unreadMessages), href: "/admin/messages" },
    { label: "Pending tasks", value: num(pendingTasks), href: "/admin/tasks" },
  ]

  return (
    <div className="space-y-7">
      <div>
        <p className="section-label">Welcome back</p>
        <h1 className="text-3xl font-bold text-gray-900 mt-1">Dashboard</h1>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {stats.map((s) => (
          <Link key={s.label} href={s.href} className="bg-white rounded-xl border border-gray-200 p-4 flex flex-col gap-2 hover:border-gray-300 transition-colors">
            <span className="section-label">{s.label}</span>
            <span className="text-3xl font-semibold tabular-nums text-gray-900" style={{ fontFamily: "var(--font-fraunces), serif" }}>{s.value}</span>
          </Link>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
          <h2 className="serif text-base font-semibold text-gray-900">Recent activity</h2>
          <span className="text-xs text-gray-400">Latest 12</span>
        </div>
        {activity.rows.length === 0 ? (
          <div className="px-5 py-12 text-center text-sm text-gray-400">No recent client activity yet.</div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {activity.rows.map((a) => (
              <li key={a.id} className="flex items-center gap-3 px-5 py-3 group hover:bg-[#FBF8F3] transition-colors">
                <Link href={hrefFor(a)} className="flex items-center gap-3 min-w-0 flex-1">
                  <span className="w-8 h-8 rounded-full flex items-center justify-center text-sm flex-shrink-0" style={{ background: "#F0E7DA" }}>
                    {a.kind === "chat" || a.kind === "message" ? "💬" : a.kind === "upload" ? "📎" : "📝"}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-gray-800 truncate group-hover:text-gray-900">
                      <span className="font-semibold text-gray-900">{nameFor(a.client_id)}</span>{" "}
                      {describe(a)}
                    </p>
                  </div>
                </Link>
                <span className="text-xs text-gray-400 tabular-nums flex-shrink-0">{relTime(a.created_at)}</span>
                <form action={dismissActivity.bind(null, a.id)} className="flex-shrink-0">
                  <button type="submit" title="Clear" className="text-gray-300 hover:text-red-600 text-sm">✕</button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
