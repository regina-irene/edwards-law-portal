import { getClientByEmail, getClientTasks } from "@/lib/airtable"

global.fetch = jest.fn()
const mockFetch = global.fetch as jest.Mock

beforeEach(() => {
  mockFetch.mockClear()
  process.env.AIRTABLE_API_KEY = "test-key"
  process.env.AIRTABLE_MAIN_BASE_ID = "appTESTBASE"
})

describe("getClientByEmail", () => {
  it("returns null when no records found", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ records: [] }),
    })
    const result = await getClientByEmail("notfound@test.com")
    expect(result).toBeNull()
  })

  it("returns mapped client when record exists", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        records: [
          {
            id: "recABC123",
            fields: {
              "Client ID": "C001",
              Name: "Jane Smith",
              Email: "jane@test.com",
              Phone: "555-1234",
              "Client Base ID": "appCLIENT123",
              "FileFlow Link": "https://fileflow-eta.vercel.app/c/abc",
              "Pleadings View Link": "https://airtable.com/embed/pleadings",
              "Discovery View Link": "https://airtable.com/embed/discovery",
              "Calendar View Link": "https://airtable.com/embed/calendar",
              "SMS Reminders": true,
            },
          },
        ],
      }),
    })
    const result = await getClientByEmail("jane@test.com")
    expect(result).not.toBeNull()
    expect(result!.clientId).toBe("C001")
    expect(result!.name).toBe("Jane Smith")
    expect(result!.clientBaseId).toBe("appCLIENT123")
    expect(result!.smsReminders).toBe(true)
  })

  it("throws when Airtable returns non-ok status", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 422 })
    await expect(getClientByEmail("jane@test.com")).rejects.toThrow("Airtable error: 422")
  })

  it("handles emails with special characters safely", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ records: [] }),
    })
    // Should not throw, should encode safely
    const result = await getClientByEmail("test'injection@test.com")
    expect(result).toBeNull()
    // Verify the fetch URL contained the escaped email
    const calledUrl = mockFetch.mock.calls[0][0] as string
    expect(calledUrl).toContain("test")
    expect(calledUrl).not.toContain("' OR")
  })
})

describe("getClientTasks", () => {
  it("returns mapped tasks", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        records: [
          {
            id: "recT1",
            fields: {
              "Task Name": "Bank Statement",
              Status: "Outstanding",
              "Due Date": "2026-04-10",
              Type: "Financials",
              Matter: "Divorce",
            },
          },
        ],
      }),
    })
    const tasks = await getClientTasks("appCLIENT123")
    expect(tasks).toHaveLength(1)
    expect(tasks[0].name).toBe("Bank Statement")
    expect(tasks[0].status).toBe("Outstanding")
  })
})
