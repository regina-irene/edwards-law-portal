// app/(admin)/admin/documents/page.tsx - Documents board: every client's
// Pleadings and Correspondence in one list (2026-08-20).
//
// The columns the Drive sync owns are read-only here. The two the firm fills in
// by hand - "Filed by" / "Sent by" and Notes - are editable in place and saved
// straight back to that client's own Airtable base. See lib/doc-board.
import { redirect } from "next/navigation"
import PageTitle from "@/components/ui/PageTitle"
import RefreshButton from "@/components/ui/RefreshButton"
import { taglineFor } from "@/lib/taglines"
import { requireAdmin } from "@/lib/admin"
import { refreshDocBoard } from "./actions"
import DocumentsBoard from "@/components/documents/DocumentsBoard"
import ArchiveToggle from "@/components/admin/ArchiveToggle"
import { buildDocBoard, type DocBoardRow } from "@/lib/doc-board"

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

export default async function AdminDocumentsPage({
  searchParams,
}: {
  searchParams: Promise<{ archived?: string }>
}) {
  const check = await requireAdmin()
  if (check.status !== "ok") redirect("/login")

  const { archived: archivedParam } = await searchParams
  const includeArchived = archivedParam === "1"

  // A failed read must show an explicit error, never a false "no documents".
  let rows: DocBoardRow[] = []
  let loadError = false
  try {
    rows = await buildDocBoard({ includeArchived })
  } catch {
    loadError = true
  }

  const refreshedAt = formatRefreshed(Date.now())

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <PageTitle title="Documents" tagline={taglineFor("admin:documents")} />
        <form action={refreshDocBoard} className="shrink-0">
          <RefreshButton label="Refresh from Airtable" />
          <span className="block text-right text-xs text-gray-500 mt-1">
            {loadError ? "Not synced - the last refresh failed" : `Last refreshed ${refreshedAt}`}
          </span>
        </form>
      </div>

      <p className="text-sm text-gray-500 -mt-3">
        Every client&apos;s pleadings and correspondence in one place. You can edit{" "}
        <strong>Filed by</strong>, <strong>Sent by</strong> and <strong>Notes</strong>; those are
        yours and the edits stick. The file name, date, folder and link come from the Google Drive
        sync, so they are shown but not editable - the next sync would write over anything typed
        there.
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <ArchiveToggle basePath="/admin/documents" includeArchived={includeArchived} />
        <span className="text-xs text-gray-400">
          {includeArchived ? "Closed cases are shown." : "Closed cases are hidden."}
        </span>
      </div>

      <DocumentsBoard initialRows={rows} loadError={loadError} />
    </div>
  )
}
