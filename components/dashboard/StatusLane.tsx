// components/dashboard/StatusLane.tsx
import { DashboardSection } from "@/lib/claude"
import TaskCard from "./TaskCard"

interface StatusLaneProps {
  section: DashboardSection
  color: "red" | "yellow" | "green"
}

const colorMap = {
  red: { dot: "bg-red-500", title: "text-red-700", header: "border-red-200 bg-red-50" },
  yellow: { dot: "bg-yellow-400", title: "text-yellow-700", header: "border-yellow-200 bg-yellow-50" },
  green: { dot: "bg-green-500", title: "text-green-700", header: "border-green-200 bg-green-50" },
}

export default function StatusLane({ section, color }: StatusLaneProps) {
  const c = colorMap[color]

  return (
    <div className="flex flex-col min-w-0">
      <div className={`flex items-center gap-2 px-4 py-3 rounded-t-lg border-b ${c.header}`}>
        <span className={`w-2.5 h-2.5 rounded-full ${c.dot}`} />
        <h3 className={`text-sm font-semibold ${c.title}`}>
          {section.title}
          <span className="ml-2 text-xs font-normal opacity-70">({section.items.length})</span>
        </h3>
      </div>
      <div className="flex-1 space-y-3 p-4 bg-gray-50 rounded-b-lg min-h-32">
        {section.items.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">Nothing here</p>
        ) : (
          section.items.map((item) => <TaskCard key={item.id} item={item} />)
        )}
      </div>
    </div>
  )
}
