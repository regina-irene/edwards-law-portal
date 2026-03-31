// app/(client)/dashboard/page.tsx
import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { getClientByEmail, getClientTasks } from "@/lib/airtable"
import { processTasks, DashboardData } from "@/lib/claude"
import StatusLane from "@/components/dashboard/StatusLane"

const LANE_COLORS: ("red" | "yellow" | "green")[] = ["red", "yellow", "green"]
const DEFAULT_LANE_COLOR = "red" as const

export default async function DashboardPage() {
  const session = await auth()
  if (!session?.user?.email) redirect("/login")

  const client = await getClientByEmail(session.user.email)
  if (!client) redirect("/login")

  let dashboard: DashboardData
  try {
    const tasks = await getClientTasks(client.clientBaseId)
    const today = new Date().toISOString().split("T")[0]
    dashboard = await processTasks(tasks, today)
  } catch (err) {
    console.error("[DashboardPage] Failed to load tasks:", err)
    dashboard = {
      sections: [
        { title: "Outstanding Documents", items: [] },
        { title: "In Progress", items: [] },
        { title: "Completed", items: [] },
      ],
    }
  }

  const overdueCount = dashboard.sections
    .flatMap((s) => s.items)
    .filter((i) => i.overdue).length

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">
          {overdueCount > 0 ? (
            <span className="text-red-600 font-medium">
              {overdueCount} overdue item{overdueCount !== 1 ? "s" : ""} — please respond promptly
            </span>
          ) : (
            "Your case items"
          )}
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {dashboard.sections.map((section, i) => (
          <StatusLane key={section.title} section={section} color={LANE_COLORS[i] ?? DEFAULT_LANE_COLOR} />
        ))}
      </div>
    </div>
  )
}
