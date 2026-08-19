// app/(admin)/admin/clients/page.tsx — the client roster. Archived (former)
// clients are hidden unless ?archived=1, and can be archived / restored here.
import { sql } from "@/lib/db"
import { clientDisplayLabel, fetchAllClientsRaw } from "@/lib/airtable"
import { getClientLabels } from "@/lib/client-labels"
import { archiveNotes, noteFor } from "@/lib/admin-archive"
import { ARCHIVE_GRACE_DAYS } from "@/lib/client-archive"
import { refreshClients } from "../actions"
import { startPreview } from "@/app/preview-actions"
import ClientLabelEditor from "../ClientLabelEditor"
import RefreshButton from "@/components/ui/RefreshButton"
import InviteButton from "@/components/admin/InviteButton"
import ArchiveButton from "@/components/admin/ArchiveButton"
import ArchivedChip from "@/components/admin/ArchivedChip"
import ArchiveToggle from "@/components/admin/ArchiveToggle"
import Link from "next/link"
import PageTitle from "@/components/ui/PageTitle"
import { taglineFor } from "@/lib/taglines"

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

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ archived?: string }>
}) {
  // The toggle lives in the URL so it survives a refresh and the Back button.
  const { archived: archivedParam } = await searchParams
  const includeArchived = archivedParam === "1"

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

  // Read-only: this never creates a stamp, so opening this page can't start
  // anyone's 30-day clock.
  const notes = await archiveNotes(clientsRaw)

  const clients = clientsRaw
    .map((c) => {
      const id = String(c.clientId)
      // `id` shadows the Airtable record id below, so keep that one under its
      // own name: the archive PATCH targets the CLIENTS-table record, while
      // everything else on this row is keyed on the linked Status record id.
      return {
        ...c,
        recordId: c.id,
        id,
        label: labels[id] || clientDisplayLabel(c.name),
        archiveNote: noteFor(notes, id).note,
      }
    })
    .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: "base" }))

  const archivedCount = clients.filter((c) => c.archived).length
  const visible = includeArchived ? clients : clients.filter((c) => !c.archived)

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
    /* capped width so name and actions stay close together on wide screens */
    <div className="space-y-6 max-w-3xl">
      <PageTitle
        title="Clients"
        tagline={taglineFor("admin:clients")}
        actions={
          <form action={refreshClients}>
            <RefreshButton />
            <span className="block text-right text-xs text-gray-400 mt-1">Last refreshed {refreshedAt}</span>
          </form>
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <ArchiveToggle basePath="/admin/clients" includeArchived={includeArchived} archivedCount={archivedCount} />
        <span className="text-xs text-gray-400">
          {visible.length} {visible.length === 1 ? "client" : "clients"}
          {!includeArchived && archivedCount > 0 && ` · ${archivedCount} archived hidden`}
        </span>
      </div>

      {clients.length === 0 ? (
        <p className="text-gray-500">No clients found in Airtable.</p>
      ) : visible.length === 0 ? (
        <p className="text-gray-500">Every client on the board is archived — switch to “Include archived” to see them.</p>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
          {visible.map((c) => {
            const activity = activityMap.get(c.id) ?? { unread_chat: 0, unread_messages: 0 }
            const actionCls = "flex flex-col items-center gap-1 px-2 py-1.5 rounded-lg hover:bg-gray-100 transition-colors w-[4.5rem]"
            return (
              <div
                key={c.id}
                className={`flex items-center justify-between px-6 py-3.5 flex-wrap gap-3 ${c.archived ? "bg-gray-50/70" : ""}`}
              >
                <div className="min-w-[14rem]">
                  <ClientLabelEditor clientId={c.id} label={c.label} />
                  <p className="text-xs text-gray-400">{c.email}</p>
                  {c.archived && <p className="mt-1"><ArchivedChip note={c.archiveNote} /></p>}
                  {activity.unread_chat > 0 && (
                    <span className="inline-block mt-1 text-xs bg-blue-100 text-blue-700 px-2.5 py-0.5 rounded-full font-medium">{activity.unread_chat} unread</span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {c.clientBaseId.startsWith("app") && (
                    <a
                      href={`https://airtable.com/${c.clientBaseId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={actionCls}
                      title="Open this client's Airtable base"
                    >
                      <span className="text-2xl leading-none">🔗</span>
                      <span className="text-[11px] font-medium text-gray-600">Airtable</span>
                    </a>
                  )}
                  <InviteButton email={c.email} firstName={(c.name.split("|")[1] ?? "").trim()} />
                  <Link href={`/admin/notes/${encodeURIComponent(c.id)}`} className={actionCls} title="Open this client's Field Notes">
                    <span className="text-2xl leading-none">📝</span>
                    <span className="text-[11px] font-medium text-gray-600">Notes</span>
                  </Link>
                  <Link href={`/admin/messages?c=${encodeURIComponent(c.id)}`} className={actionCls} title="Open this conversation in the Message Center">
                    <span className="text-2xl leading-none">💬</span>
                    <span className="text-[11px] font-medium text-gray-600">Messages</span>
                  </Link>
                  <Link href={`/admin/clients/${c.id}/pages`} className={actionCls} title="Edit this client's pages">
                    <span className="text-2xl leading-none">📄</span>
                    <span className="text-[11px] font-medium text-gray-600">Pages</span>
                  </Link>
                  <form action={startPreview.bind(null, c.id)}>
                    <button type="submit" className={actionCls} title="View the portal as this client">
                      <span className="text-2xl leading-none">👁️</span>
                      <span className="text-[11px] font-medium text-gray-600">Preview</span>
                    </button>
                  </form>
                  <ArchiveButton
                    recordId={c.recordId}
                    clientId={c.id}
                    name={c.label}
                    archived={c.archived}
                    graceDays={ARCHIVE_GRACE_DAYS}
                  />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
