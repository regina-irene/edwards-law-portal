import { render, screen } from "@testing-library/react"
import TaskCard from "@/components/dashboard/TaskCard"
import { DashboardItem } from "@/lib/claude"

const baseItem: DashboardItem = {
  id: "rec1",
  name: "Bank Statement",
  dueDate: "2026-04-10",
  status: "outstanding",
  overdue: false,
  type: "Financials",
}

describe("TaskCard", () => {
  it("renders task name", () => {
    render(<TaskCard item={baseItem} />)
    expect(screen.getByText("Bank Statement")).toBeInTheDocument()
  })

  it("renders due date", () => {
    render(<TaskCard item={baseItem} />)
    expect(screen.getByText(/Apr 10, 2026/i)).toBeInTheDocument()
  })

  it("shows OVERDUE badge when item is overdue", () => {
    const overdueItem = { ...baseItem, overdue: true }
    render(<TaskCard item={overdueItem} />)
    expect(screen.getByText("OVERDUE")).toBeInTheDocument()
  })

  it("does not show OVERDUE badge when not overdue", () => {
    render(<TaskCard item={baseItem} />)
    expect(screen.queryByText("OVERDUE")).not.toBeInTheDocument()
  })

  it("applies red styling when overdue", () => {
    const overdueItem = { ...baseItem, overdue: true }
    const { container } = render(<TaskCard item={overdueItem} />)
    expect(container.firstChild).toHaveClass("bg-red-50")
    expect(container.firstChild).toHaveClass("border-red-300")
  })
})
