// app/(client)/dashboard/page.tsx
import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { getClientTasks } from "@/lib/airtable"
import { getPortalClient } from "@/lib/portal-client"
import { processTasks, DashboardData } from "@/lib/claude"
import StatusLane from "@/components/dashboard/StatusLane"
import PageHeader from "@/components/ui/PageHeader"
import { getPageContent } from "@/lib/page-content"
import { getSetting } from "@/lib/app-settings"

const LANE_COLORS: ("red" | "yellow" | "green")[] = ["red", "yellow", "green"]
const DEFAULT_LANE_COLOR = "red" as const

export default async function DashboardPage() {
  const session = await auth()
  if (!session?.user?.email) redirect("/login")

  const client = await getPortalClient()
  if (!client) redirect("/login")

  const [pageContent, demoVideoUrl, dashboard] = await Promise.all([
    getPageContent(client.clientId, "dashboard"),
    getSetting("demo_video_url"),
    (async (): Promise<DashboardData> => {
      try {
        const tasks = await getClientTasks(client.clientBaseId)
        const today = new Date().toISOString().split("T")[0]
        return await processTasks(tasks, today)
      } catch (err) {
        console.error("[DashboardPage] Failed to load tasks:", err)
        return {
          sections: [
            { title: "Outstanding Documents", items: [] },
            { title: "In Progress", items: [] },
            { title: "Completed", items: [] },
          ],
        }
      }
    })(),
  ])

  const overdueCount = dashboard.sections.flatMap((s) => s.items).filter((i) => i.overdue).length
  const announcement = pageContent.announcement || (overdueCount > 0
    ? `${overdueCount} overdue item${overdueCount !== 1 ? "s" : ""} — please respond promptly`
    : null)

  return (
    <div className="space-y-6">
      <PageHeader defaultTitle="Dashboard" page="dashboard" content={{ ...pageContent, announcement }} />

      {demoVideoUrl && (
        <a
          href={demoVideoUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="block bg-white rounded-xl border border-gray-200 p-5 hover:border-gray-400 transition-colors"
        >
          <div className="flex items-center gap-4">
            <span className="flex items-center justify-center w-12 h-12 rounded-full text-white text-xl shrink-0" style={{ background: "#1B2D45" }}>▶</span>
            <div className="min-w-0">
              <p className="text-base font-semibold text-gray-900">New here? Watch a quick demo</p>
              <p className="text-sm text-gray-500">See how to use your client portal — opens on YouTube.</p>
            </div>
          </div>
        </a>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {dashboard.sections.map((section, i) => (
          <StatusLane key={section.title} section={section} color={LANE_COLORS[i] ?? DEFAULT_LANE_COLOR} />
        ))}
      </div>
    </div>
  )
}
