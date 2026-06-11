// app/(client)/dashboard/page.tsx — video first, then straight to the page's
// content section (no title/announcement/image block above it, per Regina).
import Link from "next/link"
import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { getPortalClient } from "@/lib/portal-client"
import { getPageContent } from "@/lib/page-content"
import { getSetting } from "@/lib/app-settings"
import { sql } from "@/lib/db"
import { RichTextView } from "@/components/ui/RichTextEditor"
import AirtableEmbed from "@/components/ui/AirtableEmbed"
import DemoVideo from "@/components/dashboard/DemoVideo"

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
  const openTasks = openTasksRes.rows
  const today = new Date(new Date().toLocaleDateString("en-US", { timeZone: "America/New_York" }))
  const fmtDue = (d: string | Date) => new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })

  return (
    <div className="space-y-6">
      {embedVideo && <DemoVideo embedUrl={embedVideo} />}

      {/* Outstanding tasks */}
      <div className="bg-white rounded-lg border border-gray-200 keep-ink">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <h2 className="text-sm font-semibold text-gray-800">
            Outstanding Tasks
            {openTasks.length > 0 && (
              <span className="ml-2 inline-flex items-center justify-center min-w-[1.5rem] px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 text-xs font-bold">{openTasks.length}</span>
            )}
          </h2>
          <Link href="/tasks" className="text-xs text-blue-600 hover:underline">View all tasks →</Link>
        </div>
        {openTasks.length === 0 ? (
          <p className="px-4 py-4 text-sm text-gray-400">You're all caught up — no outstanding tasks. 🎉</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {openTasks.slice(0, 6).map((t) => {
              const overdue = t.due_date ? new Date(t.due_date) < today : false
              return (
                <li key={t.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                  <Link href="/tasks" className="text-sm text-gray-800 hover:text-blue-700 min-w-0 truncate">{t.title}</Link>
                  <span className={`text-xs whitespace-nowrap ${overdue ? "text-red-600 font-semibold" : "text-gray-400"}`}>
                    {t.due_date ? `${overdue ? "Overdue — was due " : "Due "}${fmtDue(t.due_date)}` : "No due date"}
                  </span>
                </li>
              )
            })}
            {openTasks.length > 6 && (
              <li className="px-4 py-2.5">
                <Link href="/tasks" className="text-xs text-blue-600 hover:underline">+ {openTasks.length - 6} more on your Tasks page</Link>
              </li>
            )}
          </ul>
        )}
      </div>

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
