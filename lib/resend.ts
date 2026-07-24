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
  2. Sign in either way:
     - "Sign in with Google" (if this email is a Google account), OR
     - type your email and click "Email me a sign-in link" — then open the link we send you
  3. Always use THIS email address: ${opts.to}

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

// Magic-link sign-in email — the passwordless alternative to Google sign-in.
// Auth.js calls this from the Resend provider's sendVerificationRequest.
export async function sendMagicLinkEmail(opts: { to: string; url: string }): Promise<void> {
  const resend = getClient()
  const FROM = process.env.EMAIL_FROM ?? "portal@edwardslaw.com"

  const body = `Hello,

Click the link below to sign in to your Edwards Family Law client portal:

${opts.url}

This link works once and expires in 24 hours. If you didn't request it, you can safely ignore this email.

Warm regards,
Edwards Family Law`

  await resend.emails.send({
    from: FROM,
    to: opts.to,
    subject: "Your sign-in link — Edwards Family Law",
    text: body,
  })
}

// New-message notice — sent on every firm reply in Messages unless the
// client's "No Message Emails" box is checked on the Airtable Clients board.
// Deliberately generic: for confidentiality the message text stays in the portal.
export async function sendNewMessageEmail(opts: { to: string; firstName: string }): Promise<void> {
  const resend = getClient()
  const FROM = process.env.EMAIL_FROM ?? "portal@edwardslaw.com"
  const PORTAL_URL = process.env.AUTH_URL ?? "https://edwards-law-portal.vercel.app"

  const greeting = opts.firstName ? `Dear ${opts.firstName},` : "Hello,"
  const body = `${greeting}

You have a new secure message from Edwards Family Law.

For your privacy, the message itself can only be read in your client portal:

  ${PORTAL_URL}/messages

Sign in with Google using this email address to read and reply.

Warm regards,
Edwards Family Law`

  await resend.emails.send({
    from: FROM,
    to: opts.to,
    subject: "New message from Edwards Family Law",
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
