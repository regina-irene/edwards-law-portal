// app/(client)/dashboard/page.tsx - straight to the page's content section
// (no title/announcement/image block above it, per Regina; demo video removed 2026-07-23).
import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { getPortalClient } from "@/lib/portal-client"
import { getPageContent } from "@/lib/page-content"
import { sql } from "@/lib/db"
import { RichTextView } from "@/components/ui/RichTextView"
import AirtableEmbed from "@/components/ui/AirtableEmbed"
import OutstandingTasks from "@/components/dashboard/OutstandingTasks"
import { getPortalArchiveState } from "@/lib/client-write-guard"

export default async function DashboardPage() {
  const session = await auth()
  if (!session?.user?.email) redirect("/login")

  const client = await getPortalClient()
  if (!client) redirect("/login")

  const [pageContent, archive, openTasksRes] = await Promise.all([
    getPageContent(client.clientId, "dashboard"),
    getPortalArchiveState(client),
    sql`
      SELECT id, title, due_date, stage
      FROM client_tasks
      WHERE client_id = ${String(client.clientId)} AND status = 'pending'
      ORDER BY due_date ASC NULLS LAST, stage_order ASC, sort_order ASC, created_at ASC
    `.catch(() => ({ rows: [] as { id: string; title: string; due_date: string | null; stage: string | null }[] })),
  ])
  const openTasks = openTasksRes.rows.map((t) => ({
    id: String(t.id),
    title: String(t.title),
    due_date: t.due_date ? new Date(t.due_date).toISOString() : null,
  }))

  return (
    <div className="space-y-6">
      <OutstandingTasks initialTasks={openTasks} readOnly={archive.readOnly} />

      {pageContent.body && (
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <RichTextView html={pageContent.body} />
        </div>
      )}

      {pageContent.embed_url && (
        <AirtableEmbed url={pageContent.embed_url} title="Dashboard" height={pageContent.embed_height ?? undefined} />
      )}
    </div>
  )
}
