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
import { bodyToPlainText } from "@/lib/message-format"
import { requireAdmin, displayNameFromEmail } from "@/lib/admin"
import { ensureChatAuthorColumn } from "@/lib/ensure-columns"
import { countFormsAwaitingReview } from "@/lib/form-review"

const num = (r: any) => parseInt(r?.rows?.[0]?.count ?? "0", 10) || 0

export default async function AdminHome({
  searchParams,
}: {
  searchParams: Promise<{ archived?: string }>
}) {
  const { archived: archivedParam } = await searchParams
  const includeArchived = archivedParam === "1"

  // Who is reading this page, so "you wrote" is only said when it was you.
  // The admin layout already gates access; this is for wording, not for auth,
  // so an unreadable session just means nothing is credited to "you".
  const viewer = await requireAdmin()
  const me = viewer.status === "ok" ? viewer.email.trim().toLowerCase() : ""

  // Same reason as lib/notes-timeline: the activity query reads author_email,
  // and on a database without the column the whole feed would come back empty.
  await ensureChatAuthorColumn()

  const [clients, labels, unreadMessages, formsWaiting, openTasksRes, activity] = await Promise.all([
    fetchAllClientsRaw().catch(() => []),
    getClientLabels().catch(() => ({} as Record<string, string>)),
    sql`SELECT COUNT(*) AS count FROM chat_messages WHERE sender='client' AND read=false`.catch(() => ({ rows: [{ count: "0" }] })),
    // Forms a client has answered that nobody here has opened since. Clears
    // itself when you read them, exactly like unread messages.
    countFormsAwaitingReview(),
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
        (SELECT 'chat' AS kind, id::text AS id, client_id, body AS detail, sender, created_at, author_email FROM chat_messages
           ORDER BY created_at DESC LIMIT 500)
        UNION ALL
        (SELECT 'message', id::text, client_id, body, 'firm', created_at, NULL FROM messages
           ORDER BY created_at DESC LIMIT 500)
        UNION ALL
        (SELECT 'upload', id::text, client_id, file_name, 'client', created_at, NULL FROM task_attachments WHERE scope='client_task'
           ORDER BY created_at DESC LIMIT 500)
        UNION ALL
        (SELECT 'form', id::text, client_id, form_key, 'client', updated_at, NULL FROM form_responses
           ORDER BY updated_at DESC LIMIT 500)
        UNION ALL
        (SELECT kind, id::text, email, COALESCE(provider, ''), 'system', created_at, NULL FROM auth_activity
           ORDER BY created_at DESC LIMIT 500)
        UNION ALL
        (SELECT 'note', id::text, client_id, body_text, 'firm', created_at, NULL FROM client_notes
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

  /**
   * The message itself, not just "sent a message" (2026-08-22).
   *
   * The body was already being selected and then thrown away, so the feed said
   * the same eight words for every conversation and you had to open each one to
   * find out which mattered. Rich messages are stored as HTML, so this is run
   * through bodyToPlainText rather than sliced raw - otherwise the feed would
   * show markup.
   */
  const messageSnippet = (detail: unknown, max = 90): string => {
    const text = bodyToPlainText(String(detail ?? "")).replace(/\s+/g, " ").trim()
    if (!text) return ""
    return text.length > max ? `${text.slice(0, max - 1)}…` : text
  }

  const describe = (a: any): string => {
    if (a.kind === "chat" || a.kind === "message") {
      // Name the colleague who sent it. "you wrote" is only true when it WAS
      // you: a message Kayla sent used to read as yours, so searching the log
      // for her name found nothing and it looked as though the portal had not
      // recorded it at all. Rows written before author_email existed have no
      // author, so they keep the old wording rather than crediting a guess.
      const author = typeof a.author_email === "string" ? a.author_email.trim().toLowerCase() : ""
      const fromFirm = a.sender === "firm" || a.kind === "message"
      const who = !fromFirm
        ? "wrote"
        : !author || author === me
          ? " - you wrote"
          : ` - ${displayNameFromEmail(author).split(" ")[0]} wrote`
      const snippet = messageSnippet(a.detail)
      return snippet ? `${who}: “${snippet}”` : `${who} a message`
    }
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

  /**
   * Where clicking an entry takes you - to the THING, not to a page about the
   * client (2026-08-22). An upload used to land on that client's page editor,
   * which is not where anyone wanting to see the file was heading.
   *
   *   chat / message  the conversation, ready to reply
   *   upload          the file itself
   *   form            that client's answers to that form
   *   note            the case's field notes
   *   sign-in         the case's field notes, where sign-ins are logged
   */
  const hrefFor = (a: any): string => {
    if (AUTH_KINDS.has(a.kind)) {
      const cid = clientIdOf(a)
      return cid ? `/admin/notes/${encodeURIComponent(cid)}` : "/admin"
    }
    const id = encodeURIComponent(String(a.client_id))
    if (a.kind === "chat" || a.kind === "message") return `/admin/messages?c=${id}`
    if (a.kind === "note") return `/admin/notes/${id}`
    if (a.kind === "upload") return `/api/task-files/${encodeURIComponent(String(a.id))}`
    if (a.kind === "form") {
      return `/admin/forms/${encodeURIComponent(String(a.detail))}/${id}`
    }
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
    { label: "Forms to review", value: formsWaiting, href: "/admin/forms" },
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
                  {/* The client name goes to THEIR case; the task text goes to
                      the task board. Two destinations because "Hodges, L" and
                      "Client to do:" are two different things you might be
                      after, and the name run together with the title read as
                      one string. */}
                  <p className="text-sm text-gray-800 truncate min-w-0 flex-1">
                    <Link
                      href={`/admin/notes/${encodeURIComponent(String(t.client_id))}`}
                      className="font-semibold text-gray-900 hover:underline"
                    >
                      {nameFor(String(t.client_id))}
                    </Link>
                    <span className="text-gray-400"> - </span>
                    <Link href="/admin/tasks" className="hover:underline">
                      {t.title}
                    </Link>
                    {t.stage && (
                      <span className="ml-2 px-2 py-0.5 rounded-full text-[11px] font-semibold align-middle" style={{ background: "#eef2f7", color: "#1b2d45" }}>
                        {t.stage}
                      </span>
                    )}
                  </p>
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
