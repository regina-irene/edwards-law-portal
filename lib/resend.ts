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

// Welcome / portal invite - sent from the admin client list.
export async function sendInviteEmail(opts: { to: string; firstName: string }): Promise<void> {
  const resend = getClient()
  const FROM = process.env.EMAIL_FROM ?? "Edwards Family Law <portal@edwardsfamilylaw.com>"
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
     - type your email and click "Email me a sign-in link" - then open the link we send you
  3. Always use THIS email address: ${opts.to}

That's it - no password to create. Just be sure to use this exact email address, since it's the one connected to your case.

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

// Magic-link sign-in email - the passwordless alternative to Google sign-in.
// Auth.js calls this from the Resend provider's sendVerificationRequest.
export async function sendMagicLinkEmail(opts: { to: string; url: string }): Promise<void> {
  const resend = getClient()
  const FROM = process.env.EMAIL_FROM ?? "Edwards Family Law <portal@edwardsfamilylaw.com>"

  const body = `Hello,

Click the link below to sign in to your Edwards Family Law client portal:

${opts.url}

This link works once and expires in 24 hours. If you didn't request it, you can safely ignore this email.

Warm regards,
Edwards Family Law`

  await resend.emails.send({
    from: FROM,
    to: opts.to,
    subject: "Your sign-in link - Edwards Family Law",
    text: body,
  })
}

// New-message notice - sent on every firm reply in Messages unless the
// client's "No Message Emails" box is checked on the Airtable Clients board.
// Deliberately generic: for confidentiality the message text stays in the portal.
export async function sendNewMessageEmail(opts: { to: string; firstName: string }): Promise<void> {
  const resend = getClient()
  const FROM = process.env.EMAIL_FROM ?? "Edwards Family Law <portal@edwardsfamilylaw.com>"
  const PORTAL_URL = process.env.AUTH_URL ?? "https://edwards-law-portal.vercel.app"

  const greeting = opts.firstName ? `Dear ${opts.firstName},` : "Hello,"
  const body = `${greeting}

You have a new secure message from Edwards Family Law.

For your privacy, the message itself can only be read in your client portal:

  ${PORTAL_URL}/messages

Sign in using this email address to read and reply - with Google, or by requesting a sign-in link on the login page.

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
  const FROM = process.env.EMAIL_FROM ?? "Edwards Family Law <portal@edwardsfamilylaw.com>"
  const PORTAL_URL = process.env.AUTH_URL ?? "https://portal.edwardslaw.com"

  const subject = overdue
    ? `OVERDUE - Action Required: ${taskName}`
    : `Reminder: ${taskName} is due soon`

  const formattedDate = new Date(dueDate + "T00:00:00").toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  })

  const body = overdue
    ? `Dear ${clientName},\n\nThis is an urgent reminder that the following item is overdue:\n\n"${taskName}" - was due ${formattedDate}\n\nPlease log in to your portal as soon as possible:\n${PORTAL_URL}\n\nIf you have any questions, please contact your attorney.\n\nEdwards Family Law`
    : `Dear ${clientName},\n\nThis is a reminder that the following item is due soon:\n\n"${taskName}" - due ${formattedDate}\n\nPlease log in to your portal to submit the requested item:\n${PORTAL_URL}\n\nThank you,\nEdwards Family Law`

  await resend.emails.send({
    from: FROM,
    to,
    subject,
    text: body,
  })
}

/**
 * "You have new tasks" - sent the moment the firm assigns them (2026-08-22).
 *
 * Assigning a task used to send nothing at all. It appeared on the client's
 * Tasks page and they found out whenever they next happened to sign in, which
 * for some clients is not for days. The daily reminder job did not cover it
 * either: that one only looks at tasks with a due date, and reads them from
 * Airtable rather than the portal.
 *
 * One email per assignment, however many tasks it contained, because five
 * separate emails for one action reads as a malfunction.
 *
 * Deliberately says only the task TITLES. Anything sensitive lives behind the
 * sign-in, the same way sendNewMessageEmail never puts the message in the body.
 */
export async function sendNewTasksEmail(opts: {
  to: string
  firstName: string
  taskTitles: string[]
  dueDate?: string | null
}): Promise<void> {
  const resend = getClient()
  const FROM = process.env.EMAIL_FROM ?? "Edwards Family Law <portal@edwardsfamilylaw.com>"
  const PORTAL_URL = process.env.AUTH_URL ?? "https://edwards-law-portal.vercel.app"

  const many = opts.taskTitles.length > 1
  const greeting = opts.firstName ? `Dear ${opts.firstName},` : "Hello,"
  const list = opts.taskTitles.map((t) => `  - ${t}`).join("\n")
  const due = opts.dueDate
    ? `\nPlease complete ${many ? "these" : "this"} by ${new Date(opts.dueDate + "T00:00:00").toLocaleDateString(
        "en-US",
        { month: "long", day: "numeric", year: "numeric" }
      )}.\n`
    : ""

  const body = `${greeting}

We have added ${many ? "some items" : "an item"} to your list in the client portal:

${list}
${due}
You can complete ${many ? "them" : "it"} here:

  ${PORTAL_URL}/tasks

Sign in using this email address - with Google, or by requesting a sign-in link on the login page.

If you have any questions, reply to us in the portal and we will get back to you.

Warm regards,
Edwards Family Law`

  await resend.emails.send({
    from: FROM,
    to: opts.to,
    subject: many ? "New items on your client portal list" : "A new item on your client portal list",
    text: body,
  })
}

/**
 * "A client has filled in a form" - to the FIRM, not the client (2026-08-22).
 *
 * A client could complete a whole form and nobody at the firm would know until
 * somebody happened to open the Answers page. The portal's activity feed showed
 * it, but only to whoever was looking.
 *
 * Names the client and the form and nothing else: their answers stay behind the
 * sign-in, the same rule the client-facing emails follow.
 */
export async function sendFormSubmittedEmail(opts: {
  to: string[]
  clientName: string
  formLabel: string
  answered: number
}): Promise<void> {
  if (opts.to.length === 0) return
  const resend = getClient()
  const FROM = process.env.EMAIL_FROM ?? "Edwards Family Law <portal@edwardsfamilylaw.com>"
  const PORTAL_URL = process.env.AUTH_URL ?? "https://edwards-law-portal.vercel.app"

  const body = `${opts.clientName} has filled in the ${opts.formLabel}.

${opts.answered} ${opts.answered === 1 ? "question" : "questions"} answered.

Read their answers here:

  ${PORTAL_URL}/admin/forms

Edwards Family Law portal`

  await resend.emails.send({
    from: FROM,
    to: opts.to,
    subject: `${opts.clientName} filled in the ${opts.formLabel}`,
    text: body,
  })
}

/**
 * "Something new has been filed on your case" - to the CLIENT (2026-09-04).
 *
 * Sent by the automations in lib/automations, so it is the one email in the
 * portal that can reach a client without somebody at the firm pressing send.
 * It therefore says only what is already on the client's own portal pages: the
 * document's name, its date, and a link.
 *
 * The document links are the Drive links the portal already shows. Anyone
 * holding this email can open them without signing in, which Regina chose
 * deliberately (2026-09-04) because clients ask for the document, not for a
 * sign-in page. The portal link is included too, for everything else.
 */
export async function sendNewDocumentsEmail(opts: {
  to: string
  firstName: string
  /** "filing" / "letter" - what to call these in the sentence. */
  noun: string
  documents: { title: string; link: string; date: string | null }[]
}): Promise<void> {
  if (!opts.to || opts.documents.length === 0) return
  const resend = getClient()
  const FROM = process.env.EMAIL_FROM ?? "Edwards Family Law <portal@edwardsfamilylaw.com>"
  const PORTAL_URL = process.env.AUTH_URL ?? "https://edwards-law-portal.vercel.app"

  const n = opts.documents.length
  const greeting = opts.firstName ? `Dear ${opts.firstName},` : "Hello,"
  const noun = n === 1 ? opts.noun : `${opts.noun}s`

  const list = opts.documents
    .map((d) => `  ${d.title}${d.date ? ` (${d.date})` : ""}\n  ${d.link}`)
    .join("\n\n")

  const body = `${greeting}

${n === 1 ? `A new ${opts.noun} has` : `${n} new ${noun} have`} been added to your case file.

${list}

You can see everything on your case, including your status, documents and messages, on your portal:

  ${PORTAL_URL}

If you have questions about ${n === 1 ? "this document" : "these documents"}, reply to this email or send us a message through the portal.

Edwards Family Law`

  await resend.emails.send({
    from: FROM,
    to: opts.to,
    subject: n === 1 ? `A new ${opts.noun} on your case` : `${n} new ${noun} on your case`,
    text: body,
  })
}
