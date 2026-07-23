// __tests__/lib/resend.test.ts
import { sendReminderEmail, sendNewMessageEmail } from "@/lib/resend"

const mockSend = jest.fn().mockResolvedValue({ data: { id: "email-id-123" }, error: null })

jest.mock("resend", () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: {
      send: mockSend,
    },
  })),
}))

describe("sendReminderEmail", () => {
  beforeEach(() => {
    process.env.RESEND_API_KEY = "test-key"
    process.env.EMAIL_FROM = "portal@edwardslaw.com"
    mockSend.mockClear()
  })

  it("sends email with correct fields", async () => {
    const { Resend } = require("resend")
    const mockSendRef = Resend.mock.results[0]?.value.emails.send ?? mockSend

    await sendReminderEmail({
      to: "client@test.com",
      clientName: "Jane Smith",
      taskName: "Bank Statement",
      dueDate: "2026-04-10",
      overdue: false,
    })

    expect(mockSendRef).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "client@test.com",
        from: "portal@edwardslaw.com",
        subject: expect.stringContaining("Bank Statement"),
      })
    )
  })

  it("sends overdue email with urgent subject", async () => {
    const { Resend } = require("resend")
    const instance = new Resend()

    await sendReminderEmail({
      to: "client@test.com",
      clientName: "Jane Smith",
      taskName: "Bank Statement",
      dueDate: "2026-03-28",
      overdue: true,
    })

    expect(instance.emails.send).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: expect.stringMatching(/overdue|urgent/i),
      })
    )
  })
})

describe("sendNewMessageEmail", () => {
  beforeEach(() => {
    process.env.RESEND_API_KEY = "test-key"
    process.env.EMAIL_FROM = "portal@edwardslaw.com"
    mockSend.mockClear()
  })

  it("sends a generic notice without the message text, greeting by first name", async () => {
    const { Resend } = require("resend")
    const instance = new Resend()

    await sendNewMessageEmail({ to: "client@test.com", firstName: "Trayvon" })

    expect(instance.emails.send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "client@test.com",
        from: "portal@edwardslaw.com",
        subject: "New message from Edwards Family Law",
        text: expect.stringContaining("Dear Trayvon,"),
      })
    )
  })

  it("falls back to a plain greeting when no first name", async () => {
    const { Resend } = require("resend")
    const instance = new Resend()

    await sendNewMessageEmail({ to: "client@test.com", firstName: "" })

    expect(instance.emails.send).toHaveBeenCalledWith(
      expect.objectContaining({ text: expect.stringContaining("Hello,") })
    )
  })
})
