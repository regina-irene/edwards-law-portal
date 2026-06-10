// lib/resend.ts
import { Resend } from "resend"

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

// Welcome / portal invite — sent from the admin client list.
export async function sendInviteEmail(opts: { to: string; firstName: string }): Promise<void> {
  const resend = getClient()
  const FROM = process.env.EMAIL_FROM ?? "portal@edwardslaw.com"
  const PORTAL_URL = process.env.AUTH_URL ?? "https://edwards-law-portal.vercel.app"

  const greeting = opts.firstName ? `Dear ${opts.firstName},` : "Hello,"
  const body = `${greeting}

Welcome! Edwards Family Law has set up a secure client portal for your case. It's your one place to:

  - See the current status of your case and key dates
  - View court filings and discovery documents
  - Check your upcoming hearings and appointments
  - Review your fees, payments, and balance
  - Send secure messages and documents to your legal team

HOW TO LOG IN

  1. Go to ${PORTAL_URL}
  2. Click "Sign in with Google"
  3. Sign in with THIS email address: ${opts.to}

That's it — no password to create. Just be sure to use this exact email address, since it's the one connected to your case.

If you have any trouble signing in or any questions, simply reply to this email or contact our office.

Warm regards,
Edwards Family Law`

  await resend.emails.send({
    from: FROM,
    to: opts.to,
    subject: "Welcome to your Edwards Family Law client portal",
    text: body,
  })
}

export async function sendReminderEmail(opts: ReminderEmailOptions): Promise<void> {
  const { to, clientName, taskName, dueDate, overdue } = opts
  const resend = getClient()
  const FROM = process.env.EMAIL_FROM ?? "portal@edwardslaw.com"
  const PORTAL_URL = process.env.AUTH_URL ?? "https://portal.edwardslaw.com"

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
