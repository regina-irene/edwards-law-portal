// app/(admin)/admin/status/page.tsx — Case Status board: every client, the
// stage their case is at, and the words they read on their own Status page.
// Editable in place. Admin layout gates auth; requireAdmin gates this page.
import { redirect } from "next/navigation"
import PageTitle from "@/components/ui/PageTitle"
import { taglineFor } from "@/lib/taglines"
import { requireAdmin } from "@/lib/admin"
import StatusBoard, { type StageOption } from "@/components/status/StatusBoard"
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

export default async function AdminStatusPage() {
  const check = await requireAdmin()
  if (check.status !== "ok") redirect("/login")

  // A failed read must show an explicit error, never a false "no cases".
  let rows: CaseStatusBoardRow[] = []
  let loadError = false
  try {
    rows = await buildStatusBoard()
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

  return (
    <div className="space-y-6 max-w-5xl">
      <PageTitle title="Case Status" tagline={taglineFor("admin:status")} />
      <p className="text-sm text-gray-500 -mt-3">
        Anything you save here appears on that client&apos;s Status page. Stage names are shown in plain
        English; hover a pill to see the value on the Airtable board.
      </p>
      <StatusBoard
        initialRows={rows}
        stageOptions={stageOptions}
        initialFlags={flags}
        loadError={loadError}
      />
    </div>
  )
}
