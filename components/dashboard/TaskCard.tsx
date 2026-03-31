// components/dashboard/TaskCard.tsx
import { DashboardItem } from "@/lib/claude"

interface TaskCardProps {
  item: DashboardItem
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "No due date"
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

export default function TaskCard({ item }: TaskCardProps) {
  return (
    <div className={`rounded-lg border p-4 space-y-2 ${item.overdue ? "border-red-300 bg-red-50" : "border-gray-200 bg-white"}`}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-gray-900 leading-snug">{item.name}</p>
        {item.overdue && (
          <span className="shrink-0 text-xs font-bold text-red-600 bg-red-100 px-2 py-0.5 rounded">
            OVERDUE
          </span>
        )}
      </div>
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>{item.type}</span>
        <span>{formatDate(item.dueDate)}</span>
      </div>
    </div>
  )
}
