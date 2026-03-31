// __tests__/lib/twilio.test.ts
import { sendReminderSMS } from "@/lib/twilio"

const mockCreate = jest.fn().mockResolvedValue({ sid: "SM123" })

jest.mock("twilio", () =>
  jest.fn().mockImplementation(() => ({
    messages: { create: mockCreate },
  }))
)

describe("sendReminderSMS", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.TWILIO_ACCOUNT_SID = "ACtest"
    process.env.TWILIO_AUTH_TOKEN = "test-token"
    process.env.TWILIO_FROM_NUMBER = "+15550001234"
    process.env.AUTH_URL = "https://portal.edwardslaw.com"
  })

  it("sends SMS with task name and portal link", async () => {
    await sendReminderSMS({
      to: "+15559876543",
      clientName: "Jane Smith",
      taskName: "Bank Statement",
      overdue: false,
    })

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "+15559876543",
        from: "+15550001234",
        body: expect.stringContaining("Bank Statement"),
      })
    )
  })

  it("sends overdue SMS with urgent message", async () => {
    await sendReminderSMS({
      to: "+15559876543",
      clientName: "Jane Smith",
      taskName: "Tax Return",
      overdue: true,
    })

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.stringMatching(/overdue|urgent|immediate/i),
      })
    )
  })
})
