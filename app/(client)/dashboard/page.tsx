// app/(client)/dashboard/page.tsx
import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { getClientTasks } from "@/lib/airtable"
import { getPortalClient } from "@/lib/portal-client"
import { processTasks, DashboardData } from "@/lib/claude"
import StatusLane from "@/components/dashboard/StatusLane"
import PageHeader from "@/components/ui/PageHeader"
import { getPageContent } from "@/lib/page-content"

const LANE_COLORS: ("red" | "yellow" | "green")[] = ["red", "yellow", "green"]
const DEFAULT_LANE_COLOR = "red" as const

export default async function DashboardPage() {
  const session = await auth()
  if (!session?.user?.email) redirect("/login")

  const client = await getPortalClient()
  if (!client) redirect("/login")

  const [pageContent, dashboard] = await Promise.all([
    getPageContent(client.clientId, "dashboard"),
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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {dashboard.sections.map((section, i) => (
          <StatusLane key={section.title} section={section} color={LANE_COLORS[i] ?? DEFAULT_LANE_COLOR} />
        ))}
      </div>
    </div>
  )
}
