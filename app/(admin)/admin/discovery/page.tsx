// app/(admin)/admin/discovery/page.tsx - Discovery board: every client's
// Discovery table, fully editable (2026-08-20).
//
// Separate from the Documents board on purpose. Pleadings and Correspondence
// are built by the Drive sync and only two columns there are safe to touch;
// Discovery is the firm's own table, so everything is editable - including the
// "Avail. to Client" checkbox that decides what the client sees.
import { redirect } from "next/navigation"
import PageTitle from "@/components/ui/PageTitle"
import RefreshButton from "@/components/ui/RefreshButton"
import { taglineFor } from "@/lib/taglines"
import { requireAdmin } from "@/lib/admin"
import { refreshDiscoveryBoard } from "./actions"
import DiscoveryBoard from "@/components/discovery/DiscoveryBoard"
import ArchiveToggle from "@/components/admin/ArchiveToggle"
import {
  buildDiscoveryBoard,
  type DiscoveryBoardRow,
  type DiscoveryChoicesByBase,
} from "@/lib/discovery-board"

export const dynamic = "force-dynamic"

function formatRefreshed(ms: number): string {
  return new Date(ms).toLocaleString("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

export default async function AdminDiscoveryPage({
  searchParams,
}: {
  searchParams: Promise<{ archived?: string }>
}) {
  const check = await requireAdmin()
  if (check.status !== "ok") redirect("/login")

  const { archived: archivedParam } = await searchParams
  const includeArchived = archivedParam === "1"

  // A failed read must show an explicit error, never a false "nothing here".
  let rows: DiscoveryBoardRow[] = []
  let choices: DiscoveryChoicesByBase = {}
  let loadError = false
  try {
    const board = await buildDiscoveryBoard({ includeArchived })
    rows = board.rows
    choices = board.choices
  } catch {
    loadError = true
  }

  const refreshedAt = formatRefreshed(Date.now())

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <PageTitle title="Discovery" tagline={taglineFor("admin:discovery")} />
        <form action={refreshDiscoveryBoard} className="shrink-0">
          <RefreshButton label="Refresh from Airtable" />
          <span className="block text-right text-xs text-gray-500 mt-1">
            {loadError ? "Not synced - the last refresh failed" : `Last refreshed ${refreshedAt}`}
          </span>
        </form>
      </div>

      <p className="text-sm text-gray-500 -mt-3">
        Every client&apos;s Discovery table. None of it comes from the Drive sync, so everything
        here is editable. <strong>The tick on each row is the gate</strong>: only ticked rows appear
        on that client&apos;s own Discovery page. Rows the client cannot see are shown greyed.
        Where a link points at a Google Drive folder, its contents can be listed without leaving
        the portal.
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <ArchiveToggle basePath="/admin/discovery" includeArchived={includeArchived} />
        <span className="text-xs text-gray-400">
          {includeArchived ? "Closed cases are shown." : "Closed cases are hidden."}
        </span>
      </div>

      <DiscoveryBoard initialRows={rows} choices={choices} loadError={loadError} />
    </div>
  )
}
