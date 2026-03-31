import { render, screen } from "@testing-library/react"
import StatusLane from "@/components/dashboard/StatusLane"
import { DashboardSection } from "@/lib/claude"

const section: DashboardSection = {
  title: "Outstanding Documents",
  items: [
    { id: "r1", name: "Bank Statement", dueDate: "2026-04-10", status: "outstanding", overdue: false, type: "Financials" },
    { id: "r2", name: "Tax Return", dueDate: "2026-04-15", status: "outstanding", overdue: false, type: "Financials" },
  ],
}

describe("StatusLane", () => {
  it("renders section title", () => {
    render(<StatusLane section={section} color="red" />)
    expect(screen.getByText("Outstanding Documents")).toBeInTheDocument()
  })

  it("renders all items", () => {
    render(<StatusLane section={section} color="red" />)
    expect(screen.getByText("Bank Statement")).toBeInTheDocument()
    expect(screen.getByText("Tax Return")).toBeInTheDocument()
  })

  it("shows empty state when no items", () => {
    render(<StatusLane section={{ ...section, items: [] }} color="red" />)
    expect(screen.getByText(/nothing here/i)).toBeInTheDocument()
  })
})
