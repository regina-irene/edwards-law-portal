import { GET } from "@/app/api/cron/reminders/route"

jest.mock("@/lib/airtable", () => ({
  getAllClients: jest.fn(),
  getClientTasks: jest.fn(),
}))
jest.mock("@/lib/resend", () => ({ sendReminderEmail: jest.fn() }))
jest.mock("@/lib/twilio", () => ({ sendReminderSMS: jest.fn() }))

import { getAllClients, getClientTasks } from "@/lib/airtable"
import { sendReminderEmail } from "@/lib/resend"
import { sendReminderSMS } from "@/lib/twilio"

const mockGetAllClients = getAllClients as jest.Mock
const mockGetClientTasks = getClientTasks as jest.Mock
const mockSendEmail = sendReminderEmail as jest.Mock
const mockSendSMS = sendReminderSMS as jest.Mock

beforeEach(() => {
  jest.clearAllMocks()
  process.env.CRON_SECRET = "test-secret"
})

describe("GET /api/cron/reminders", () => {
  it("returns 401 without correct CRON_SECRET header", async () => {
    const req = new Request("http://localhost/api/cron/reminders", {
      headers: { authorization: "Bearer wrong-secret" },
    })
    const res = await GET(req)
    expect(res.status).toBe(401)
  })

  it("sends email for task due in 3 days", async () => {
    const today = new Date()
    const in3Days = new Date(today)
    in3Days.setDate(today.getDate() + 3)
    const dueDateStr = in3Days.toISOString().split("T")[0]

    mockGetAllClients.mockResolvedValueOnce([
      {
        clientId: "C001",
        name: "Jane Smith",
        email: "jane@test.com",
        phone: "+15551234567",
        clientBaseId: "appCLIENT",
        smsReminders: false,
      },
    ])
    mockGetClientTasks.mockResolvedValueOnce([
      { id: "recT1", name: "Bank Statement", status: "Outstanding", dueDate: dueDateStr, type: "Financials", matter: "Divorce" },
    ])

    const req = new Request("http://localhost/api/cron/reminders", {
      headers: { authorization: "Bearer test-secret" },
    })
    const res = await GET(req)
    expect(res.status).toBe(200)
    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "jane@test.com",
        taskName: "Bank Statement",
        overdue: false,
      })
    )
    expect(mockSendSMS).not.toHaveBeenCalled()
  })

  it("sends SMS when smsReminders is true and task is overdue", async () => {
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const dueDateStr = yesterday.toISOString().split("T")[0]

    mockGetAllClients.mockResolvedValueOnce([
      {
        clientId: "C001",
        name: "Jane Smith",
        email: "jane@test.com",
        phone: "+15551234567",
        clientBaseId: "appCLIENT",
        smsReminders: true,
      },
    ])
    mockGetClientTasks.mockResolvedValueOnce([
      { id: "recT1", name: "Tax Return", status: "Outstanding", dueDate: dueDateStr, type: "Financials", matter: "Divorce" },
    ])

    const req = new Request("http://localhost/api/cron/reminders", {
      headers: { authorization: "Bearer test-secret" },
    })
    await GET(req)
    expect(mockSendSMS).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "+15551234567",
        taskName: "Tax Return",
        overdue: true,
      })
    )
  })
})
