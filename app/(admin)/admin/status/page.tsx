// app/(admin)/admin/status/page.tsx — Case Status board: every client, the
// stage their case is at, and the words they read on their own Status page.
// Editable in place. Admin layout gates auth; requireAdmin gates this page.
import { redirect } from "next/navigation"
import PageTitle from "@/components/ui/PageTitle"
import RefreshButton from "@/components/ui/RefreshButton"
import { taglineFor } from "@/lib/taglines"
import { requireAdmin } from "@/lib/admin"
import { refreshStatusBoard } from "./actions"
import StatusBoard, { type StageOption } from "@/components/status/StatusBoard"
import ArchiveToggle from "@/components/admin/ArchiveToggle"
import {
  buildStatusBoard,
  computeStuckFlags,
  plainStage,
  stageOrder,
  CASE_STAGE_CHOICES,
  type CaseStatusBoardRow,
  type CaseFlag,
} from "@/lib/case-status"

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

export default async function AdminStatusPage({
  searchParams,
}: {
  searchParams: Promise<{ archived?: string }>
}) {
  const check = await requireAdmin()
  if (check.status !== "ok") redirect("/login")

  // In the URL so it survives a refresh. buildStatusBoard defaults to hiding
  // archived cases, so only this page's toggle ever asks for them.
  const { archived: archivedParam } = await searchParams
  const includeArchived = archivedParam === "1"

  // A failed read must show an explicit error, never a false "no cases".
  let rows: CaseStatusBoardRow[] = []
  let loadError = false
  try {
    rows = await buildStatusBoard({ includeArchived })
  } catch {
    loadError = true
  }

  const flags: CaseFlag[] = loadError ? [] : computeStuckFlags(rows)

  // The stage vocabulary, in board order, with its plain-English label. Passed
  // down as a prop so the client bundle never imports lib/case-status (that
  // module uses next/cache, which is server-only).
  const stageOptions: StageOption[] = [...CASE_STAGE_CHOICES]
    .sort((a, b) => stageOrder(a) - stageOrder(b) || a.localeCompare(b))
    .map((value) => ({ value, label: plainStage(value) }))

  // Rendered on the server at request time. The board is read through a 60s
  // cache, so this is "when this page was built", and Refresh drops the cache
  // before re-rendering — the timestamp only moves when the data actually did.
  const refreshedAt = formatRefreshed(Date.now())

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <PageTitle title="Case Status" tagline={taglineFor("admin:status")} />
        <form action={refreshStatusBoard} className="shrink-0">
          <RefreshButton label="Refresh from Airtable" />
          <span className="block text-right text-xs text-gray-500 mt-1">
            {loadError ? "Not synced — the last refresh failed" : `Last refreshed ${refreshedAt}`}
          </span>
        </form>
      </div>
      <p className="text-sm text-gray-500 -mt-3">
        Anything you save here appears on that client&apos;s Status page. Stage names are shown in plain
        English; hover a pill to see the value on the Airtable board.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <ArchiveToggle basePath="/admin/status" includeArchived={includeArchived} />
        <span className="text-xs text-gray-400">
          {includeArchived
            ? "Closed cases are shown, marked Archived. They're never flagged as stuck."
            : "Closed cases are hidden."}
        </span>
      </div>
      <StatusBoard
        initialRows={rows}
        stageOptions={stageOptions}
        initialFlags={flags}
        loadError={loadError}
      />
    </div>
  )
}
