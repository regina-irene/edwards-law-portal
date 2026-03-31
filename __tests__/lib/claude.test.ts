/**
 * @jest-environment node
 */
import { processTasks, DashboardData } from "@/lib/claude"

jest.mock("@anthropic-ai/sdk", () => {
  const mockCreate = jest.fn()
  return {
    default: jest.fn().mockImplementation(() => ({
      messages: { create: mockCreate },
    })),
    __mockCreate: mockCreate,
  }
})

describe("processTasks", () => {
  let mockCreate: jest.Mock

  beforeEach(() => {
    const sdk = require("@anthropic-ai/sdk")
    mockCreate = sdk.__mockCreate
    mockCreate.mockClear()
    process.env.ANTHROPIC_API_KEY = "test-key"
  })

  it("returns parsed dashboard data from Claude response", async () => {
    const mockDashboard: DashboardData = {
      sections: [
        {
          title: "Outstanding Documents",
          items: [
            {
              id: "recT1",
              name: "Bank Statement",
              dueDate: "2026-04-10",
              status: "outstanding",
              overdue: false,
              type: "Financials",
            },
          ],
        },
        { title: "In Progress", items: [] },
        { title: "Completed", items: [] },
      ],
    }
    mockCreate.mockResolvedValueOnce({
      content: [{ type: "text", text: JSON.stringify(mockDashboard) }],
    })
    const tasks = [
      { id: "recT1", name: "Bank Statement", status: "Outstanding", dueDate: "2026-04-10", type: "Financials", matter: "Divorce" },
    ]
    const result = await processTasks(tasks, "2026-03-30")
    expect(result.sections).toHaveLength(3)
    expect(result.sections[0].title).toBe("Outstanding Documents")
    expect(result.sections[0].items[0].name).toBe("Bank Statement")
  })

  it("returns default three-lane structure when Claude returns invalid JSON", async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: "text", text: "not json" }],
    })
    const tasks = [{ id: "recT1", name: "Bank Statement", status: "Outstanding", dueDate: "2026-04-10", type: "Financials", matter: "Divorce" }]
    const result = await processTasks(tasks, "2026-03-30")
    expect(result.sections).toHaveLength(3)
    expect(result.sections[0].title).toBe("Outstanding Documents")
    expect(result.sections[1].title).toBe("In Progress")
    expect(result.sections[2].title).toBe("Completed")
    result.sections.forEach(section => expect(section.items).toEqual([]))
  })
})
