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
import {
  CLIENT_ACTION_CLS,
  CLIENT_ACTION_ICON_CLS,
  CLIENT_ACTION_LABEL_CLS,
} from "@/components/admin/client-action-style"
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
    /* Wider than the other admin pages on purpose: seven row actions plus the
       name need the room, and cramping them is what pushed some rows' icons
       onto a second line. */
    <div className="space-y-6 max-w-6xl">
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
            return (
              /* No flex-wrap: the actions never drop below the name, so every
                 row looks the same whether or not a client has an Airtable
                 base or unread messages. The name column shrinks instead. */
              <div
                key={c.id}
                className={`flex items-center justify-between gap-4 px-6 py-2.5 ${c.archived ? "bg-gray-50/70" : ""}`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <ClientLabelEditor clientId={c.id} label={c.label} />
                    {c.archived && <ArchivedChip note={c.archiveNote} />}
                    {activity.unread_chat > 0 && (
                      <span className="shrink-0 text-xs bg-blue-100 text-blue-700 px-2.5 py-0.5 rounded-full font-medium">{activity.unread_chat} unread</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 truncate">{c.email}</p>
                </div>
                <div className="flex items-center gap-0.5 shrink-0">
                  {c.clientBaseId.startsWith("app") && (
                    <a
                      href={`https://airtable.com/${c.clientBaseId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={CLIENT_ACTION_CLS}
                      title="Open this client's Airtable base"
                    >
                      <span className={CLIENT_ACTION_ICON_CLS}>🔗</span>
                      <span className={CLIENT_ACTION_LABEL_CLS}>Airtable</span>
                    </a>
                  )}
                  <InviteButton email={c.email} firstName={(c.name.split("|")[1] ?? "").trim()} />
                  <Link href={`/admin/notes/${encodeURIComponent(c.id)}`} className={CLIENT_ACTION_CLS} title="Open this client's Field Notes">
                    <span className={CLIENT_ACTION_ICON_CLS}>📝</span>
                    <span className={CLIENT_ACTION_LABEL_CLS}>Notes</span>
                  </Link>
                  <Link href={`/admin/messages?c=${encodeURIComponent(c.id)}`} className={CLIENT_ACTION_CLS} title="Open this conversation in the Message Center">
                    <span className={CLIENT_ACTION_ICON_CLS}>💬</span>
                    <span className={CLIENT_ACTION_LABEL_CLS}>Messages</span>
                  </Link>
                  <Link href={`/admin/clients/${c.id}/pages`} className={CLIENT_ACTION_CLS} title="Edit this client's pages">
                    <span className={CLIENT_ACTION_ICON_CLS}>📄</span>
                    <span className={CLIENT_ACTION_LABEL_CLS}>Pages</span>
                  </Link>
                  <form action={startPreview.bind(null, c.id)}>
                    <button type="submit" className={CLIENT_ACTION_CLS} title="View the portal as this client">
                      <span className={CLIENT_ACTION_ICON_CLS}>👁️</span>
                      <span className={CLIENT_ACTION_LABEL_CLS}>Preview</span>
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
