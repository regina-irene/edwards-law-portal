// lib/resend.ts
import { Resend } from "resend"

const FROM = process.env.EMAIL_FROM ?? "portal@edwardslaw.com"
const PORTAL_URL = process.env.AUTH_URL ?? "https://portal.edwardslaw.com"

interface ReminderEmailOptions {
  to: string
  clientName: string
  taskName: string
  dueDate: string
  overdue: boolean
}

function getClient() {
  return new Resend(process.env.RESEND_API_KEY!)
}

export async function sendReminderEmail(opts: ReminderEmailOptions): Promise<void> {
  const { to, clientName, taskName, dueDate, overdue } = opts
  const resend = getClient()

  const subject = overdue
    ? `OVERDUE — Action Required: ${taskName}`
    : `Reminder: ${taskName} is due soon`

  const formattedDate = new Date(dueDate + "T00:00:00").toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  })

  const body = overdue
    ? `Dear ${clientName},\n\nThis is an urgent reminder that the following item is overdue:\n\n"${taskName}" — was due ${formattedDate}\n\nPlease log in to your portal as soon as possible:\n${PORTAL_URL}\n\nIf you have any questions, please contact your attorney.\n\nEdwards Family Law`
    : `Dear ${clientName},\n\nThis is a reminder that the following item is due soon:\n\n"${taskName}" — due ${formattedDate}\n\nPlease log in to your portal to submit the requested item:\n${PORTAL_URL}\n\nThank you,\nEdwards Family Law`

  await resend.emails.send({
    from: FROM,
    to,
    subject,
    text: body,
  })
}
