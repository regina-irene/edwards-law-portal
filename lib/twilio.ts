// lib/twilio.ts
import twilio from "twilio"

interface ReminderSMSOptions {
  to: string
  clientName: string
  taskName: string
  overdue: boolean
}

export async function sendReminderSMS(opts: ReminderSMSOptions): Promise<void> {
  const { to, taskName, overdue } = opts
  const PORTAL_URL = process.env.AUTH_URL ?? "https://portal.edwardslaw.com"

  const client = twilio(
    process.env.TWILIO_ACCOUNT_SID!,
    process.env.TWILIO_AUTH_TOKEN!
  )

  const body = overdue
    ? `Edwards Family Law: OVERDUE — "${taskName}" requires your immediate attention. Log in: ${PORTAL_URL}`
    : `Edwards Family Law: Reminder — "${taskName}" is due soon. Log in: ${PORTAL_URL}`

  await client.messages.create({
    body,
    from: process.env.TWILIO_FROM_NUMBER!,
    to,
  })
}
