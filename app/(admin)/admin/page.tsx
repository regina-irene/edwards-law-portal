// app/(admin)/admin/page.tsx - admin Home / dashboard with activity.
// Archived (former) clients are left out of the count, the open-task list and
// the activity feed unless ?archived=1.
import { sql } from "@/lib/db"
import { fetchAllClientsRaw, clientDisplayLabel } from "@/lib/airtable"
import { getClientLabels } from "@/lib/client-labels"
import ArchiveToggle from "@/components/admin/ArchiveToggle"
import Link from "next/link"
import PageTitle from "@/components/ui/PageTitle"
import { taglineFor } from "@/lib/taglines"
import ActivityFeed from "@/components/admin/ActivityFeed"

const num = (r: any) => parseInt(r?.rows?.[0]?.count ?? "0", 10) || 0

export default async function AdminHome({
  searchParams,
}: {
  searchParams: Promise<{ archived?: string }>
}) {
  const { archived: archivedParam } = await searchParams
  const includeArchived = archivedParam === "1"

  const [clients, labels, unreadMessages, openTasksRes, activity] = await Promise.all([
    fetchAllClientsRaw().catch(() => []),
    getClientLabels().catch(() => ({} as Record<string, string>)),
    sql`SELECT COUNT(*) AS count FROM chat_messages WHERE sender='client' AND read=false`.catch(() => ({ rows: [{ count: "0" }] })),
    sql`
      SELECT id, client_id, title, due_date, stage
      FROM client_tasks WHERE status='pending'
      ORDER BY due_date ASC NULLS LAST, created_at ASC
    `.catch(() => ({ rows: [] as any[] })),
    // Each branch is capped and sorted on its OWN table so it can ride that
    // table's (created_at DESC) index and hand back 500 rows instead of the
    // whole table; the outer sort then merges six small lists rather than
    // sorting the entire union. NOT EXISTS (not NOT IN) so a NULL event_id in
    // dismissed_activity can never blank the feed.
    sql`
      SELECT * FROM (
        (SELECT 'chat' AS kind, id::text AS id, client_id, body AS detail, sender, created_at FROM chat_messages
           ORDER BY created_at DESC LIMIT 500)
        UNION ALL
        (SELECT 'message', id::text, client_id, body, 'firm', created_at FROM messages
           ORDER BY created_at DESC LIMIT 500)
        UNION ALL
        (SELECT 'upload', id::text, client_id, file_name, 'client', created_at FROM task_attachments WHERE scope='client_task'
           ORDER BY created_at DESC LIMIT 500)
        UNION ALL
        (SELECT 'form', id::text, client_id, form_key, 'client', updated_at FROM form_responses
           ORDER BY updated_at DESC LIMIT 500)
        UNION ALL
        (SELECT kind, id::text, email, COALESCE(provider, ''), 'system', created_at FROM auth_activity
           ORDER BY created_at DESC LIMIT 500)
        UNION ALL
        (SELECT 'note', id::text, client_id, body_text, 'firm', created_at FROM client_notes
           ORDER BY created_at DESC LIMIT 500)
      ) a
      WHERE NOT EXISTS (SELECT 1 FROM dismissed_activity d WHERE d.event_id = a.id)
      ORDER BY created_at DESC LIMIT 500
    `.catch(() => ({ rows: [] as any[] })),
  ])

  // Names are looked up from the WHOLE roster on purpose. Filtering the roster
  // here instead would leave any archived row that IS shown reading
  // "A client" - worse than showing it, not better.
  const labelById = new Map(clients.map((c) => [String(c.clientId), labels[String(c.clientId)] || clientDisplayLabel(c.name)]))
  const nameFor = (id: string) => labelById.get(id) || "A client"

  const archivedIds = new Set(clients.filter((c) => c.archived).map((c) => String(c.clientId)))
  const archivedCount = archivedIds.size
  const activeClients = clients.filter((c) => !c.archived)

  // auth_activity rows carry an EMAIL in the client_id slot - map it back to
  // the client where possible; otherwise show the raw address (e.g. Regina's).
  const AUTH_KINDS = new Set(["link_sent", "sign_in"])
  const emailToId = new Map(
    clients.filter((c) => c.email && c.clientId).map((c) => [String(c.email).toLowerCase(), String(c.clientId)])
  )
  const clientIdOf = (a: any): string | null =>
    AUTH_KINDS.has(a.kind) ? emailToId.get(String(a.client_id).toLowerCase()) ?? null : String(a.client_id)
  const displayName = (a: any): string => {
    if (AUTH_KINDS.has(a.kind)) {
      const cid = clientIdOf(a)
      return cid ? nameFor(cid) : String(a.client_id)
    }
    return nameFor(a.client_id)
  }

  const describe = (a: any): string => {
    if (a.kind === "chat") return a.sender === "firm" ? " - you sent a message" : "sent a message"
    if (a.kind === "message") return " - you sent a message"
    if (a.kind === "upload") return `uploaded ${a.detail}`
    if (a.kind === "form") return `updated the ${String(a.detail).replace(/-/g, " ")} form`
    if (a.kind === "link_sent") return "was emailed a sign-in link"
    if (a.kind === "sign_in") return `signed in${a.detail === "google" ? " with Google" : a.detail === "resend" ? " via email link" : ""}`
    if (a.kind === "note") {
      const snippet = String(a.detail ?? "").slice(0, 60)
      return ` - you wrote a field note${snippet ? `: “${snippet}${String(a.detail).length > 60 ? "…" : ""}”` : ""}`
    }
    return "activity"
  }

  // Where clicking an activity row takes you: messages → that conversation;
  // uploads & form updates → that client's record page; sign-ins → Field Notes.
  const hrefFor = (a: any): string => {
    if (AUTH_KINDS.has(a.kind)) {
      const cid = clientIdOf(a)
      return cid ? `/admin/notes/${encodeURIComponent(cid)}` : "/admin"
    }
    const id = encodeURIComponent(String(a.client_id))
    if (a.kind === "chat" || a.kind === "message") return `/admin/messages?c=${id}`
    if (a.kind === "note") return `/admin/notes/${id}`
    return `/admin/clients/${id}/pages`
  }

  // A closed case's leftover task isn't work waiting to be done, so it neither
  // shows in the list nor counts towards "Pending tasks".
  const openTasks = (openTasksRes.rows as any[]).filter(
    (t: any) => includeArchived || !archivedIds.has(String(t.client_id))
  )
  const activityRows = (activity.rows as any[]).filter((a: any) => {
    if (includeArchived) return true
    const cid = clientIdOf(a)
    return !cid || !archivedIds.has(cid)
  })
  const today = new Date(new Date().toLocaleDateString("en-US", { timeZone: "America/New_York" }))
  const fmtDue = (d: string | Date) => new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })

  const stats = [
    {
      label: "Clients",
      value: includeArchived ? clients.length : activeClients.length,
      href: includeArchived ? "/admin/clients?archived=1" : "/admin/clients",
    },
    { label: "Unread messages", value: num(unreadMessages), href: "/admin/messages" },
    { label: "Pending tasks", value: openTasks.length, href: "/admin/tasks" },
  ]

  return (
    <div className="space-y-7">
      <div>
        <p className="section-label">Welcome back</p>
        <PageTitle title="Dashboard" tagline={taglineFor("admin:dashboard")} />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <ArchiveToggle basePath="/admin" includeArchived={includeArchived} archivedCount={archivedCount} />
        {!includeArchived && archivedCount > 0 && (
          <span className="text-xs text-gray-400">
            {archivedCount} archived {archivedCount === 1 ? "client is" : "clients are"} hidden from these counts.
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {stats.map((s) => (
          <Link key={s.label} href={s.href} className="bg-white rounded-xl border border-gray-200 p-4 flex flex-col gap-2 hover:border-gray-300 transition-colors">
            <span className="section-label">{s.label}</span>
            <span className="text-3xl font-semibold tabular-nums text-gray-900" style={{ fontFamily: "var(--font-baskerville), serif" }}>{s.value}</span>
          </Link>
        ))}
      </div>

      {/* Open tasks across all clients */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
          <h2 className="serif text-base font-semibold text-gray-900">Open tasks</h2>
          <Link href="/admin/tasks" className="text-xs text-blue-600 hover:underline">Manage tasks →</Link>
        </div>
        {openTasks.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-gray-400">No open tasks - everything's done.</div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {openTasks.slice(0, 10).map((t: any) => {
              const overdue = t.due_date ? new Date(t.due_date) < today : false
              return (
                <li key={t.id} className="flex items-center gap-3 px-5 py-2.5">
                  <Link href="/admin/tasks" className="min-w-0 flex-1">
                    <p className="text-sm text-gray-800 truncate">
                      <span className="font-semibold text-gray-900">{nameFor(String(t.client_id))}</span>
                      {"-"}{t.title}
                    </p>
                  </Link>
                  <span className={`text-xs whitespace-nowrap flex-shrink-0 ${overdue ? "text-red-600 font-semibold" : "text-gray-400"}`}>
                    {t.due_date ? `${overdue ? "Overdue - was due " : "Due "}${fmtDue(t.due_date)}` : "No due date"}
                  </span>
                </li>
              )
            })}
            {openTasks.length > 10 && (
              <li className="px-5 py-2.5">
                <Link href="/admin/tasks" className="text-xs text-blue-600 hover:underline">+ {openTasks.length - 10} more on the Tasks page</Link>
              </li>
            )}
          </ul>
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
          <h2 className="serif text-base font-semibold text-gray-900">Activity</h2>
          <span className="text-xs text-gray-400">{activityRows.length === 500 ? "Latest 500" : `${activityRows.length} total`}</span>
        </div>
        <ActivityFeed
          items={activityRows.map((a) => ({
            id: String(a.id),
            kind: String(a.kind),
            name: displayName(a),
            text: describe(a),
            href: hrefFor(a),
            at: new Date(a.created_at).toISOString(),
          }))}
        />
      </div>
    </div>
  )
}
