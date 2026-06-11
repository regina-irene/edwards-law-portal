// app/(client)/dashboard/page.tsx — video first, then straight to the page's
// content section (no title/announcement/image block above it, per Regina).
import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { getPortalClient } from "@/lib/portal-client"
import { getPageContent } from "@/lib/page-content"
import { getSetting } from "@/lib/app-settings"
import { sql } from "@/lib/db"
import { RichTextView } from "@/components/ui/RichTextEditor"
import AirtableEmbed from "@/components/ui/AirtableEmbed"
import DemoVideo from "@/components/dashboard/DemoVideo"
import OutstandingTasks from "@/components/dashboard/OutstandingTasks"

// "https://www.youtube.com/watch?v=abc" / "https://youtu.be/abc" → embeddable player URL
function youtubeEmbedUrl(url: string): string | null {
  try {
    const u = new URL(url)
    if (u.hostname.includes("youtu.be")) return `https://www.youtube.com/embed/${u.pathname.slice(1)}`
    if (u.pathname.startsWith("/embed/")) return url
    const v = u.searchParams.get("v")
    if (v) return `https://www.youtube.com/embed/${v}`
  } catch {}
  return null
}

export default async function DashboardPage() {
  const session = await auth()
  if (!session?.user?.email) redirect("/login")

  const client = await getPortalClient()
  if (!client) redirect("/login")

  const [pageContent, demoVideoUrl, openTasksRes] = await Promise.all([
    getPageContent(client.clientId, "dashboard"),
    getSetting("demo_video_url"),
    sql`
      SELECT id, title, due_date, stage
      FROM client_tasks
      WHERE client_id = ${String(client.clientId)} AND status = 'pending'
      ORDER BY due_date ASC NULLS LAST, stage_order ASC, sort_order ASC, created_at ASC
    `.catch(() => ({ rows: [] as { id: string; title: string; due_date: string | null; stage: string | null }[] })),
  ])
  const embedVideo = demoVideoUrl ? youtubeEmbedUrl(demoVideoUrl) : null
  const openTasks = openTasksRes.rows.map((t) => ({
    id: String(t.id),
    title: String(t.title),
    due_date: t.due_date ? new Date(t.due_date).toISOString() : null,
  }))

  return (
    <div className="space-y-6">
      {embedVideo && <DemoVideo embedUrl={embedVideo} />}

      <OutstandingTasks initialTasks={openTasks} />

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
