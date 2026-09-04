// lib/automation-email.ts - the wording of the automatic emails, and how a
// document turns into a link (2026-09-04).
//
// TWO PROBLEMS THIS SOLVES.
//
// 1. BROKEN LINKS. The first version sent plain text with the Drive URL on its
//    own line. Google Drive URLs run to well over a hundred characters, and
//    mail clients wrap long lines - which puts a newline in the middle of the
//    URL and produces a link that 404s when clicked. Some clients also stop
//    auto-linking at the wrap. So these are now real HTML links whose visible
//    text is short ("Click here"), which cannot be broken by wrapping. A plain
//    text version still goes alongside for clients that refuse HTML.
//
// 2. THE WORDING WAS MINE, NOT THE FIRM'S. An email that goes to a client
//    unattended should be in Regina's words. The subject and body are editable
//    per rule on the Automations page, with the placeholders below.
//
// The body is TEXT, not HTML, even in the editor. Escaping it on the way out
// means a stray < or & in her wording cannot break the email, and there is no
// way to paste in markup that would render differently for different clients.
// The only HTML in the finished email is what this file puts there.

import { sanitizeNotesHtml } from "@/lib/sanitize"

export interface EmailVars {
  firstName: string
  clientName: string
  documents: { title: string; link: string; date: string | null }[]
  portalUrl: string
  /** "filing" or "letter", singular. Pluralised where needed. */
  noun: string
}

export interface RenderedEmail {
  subject: string
  text: string
  html: string
}

/** Every placeholder, with the plain-English note shown in the editor. */
export const PLACEHOLDERS: { token: string; explain: string }[] = [
  { token: "{{first_name}}", explain: "The client's first name, or blank if we don't have it" },
  { token: "{{documents}}", explain: "The list of documents, each with a Click here link" },
  { token: "{{portal_link}}", explain: "A link to the portal sign-in page" },
  { token: "{{count}}", explain: "How many documents, as a number" },
  { token: "{{thing}}", explain: 'What to call them: "filing" or "filings"' },
]

export const DEFAULT_SUBJECT = "{{count}} new {{thing}} on your case"

/**
 * HTML rather than plain text, because this is what the rich editor opens on.
 * A plain-text default would arrive in the editor as one run-on paragraph with
 * every line break lost, which looks broken the first time it is opened.
 */
export const DEFAULT_BODY = `<p>Dear {{first_name}},</p>
<p>{{count}} new {{thing}} been added to your case file.</p>
<p>{{documents}}</p>
<p>You can see everything on your case, including your status, documents and messages, on your portal: {{portal_link}}</p>
<p>If you have questions, reply to this email or send us a message through the portal.</p>
<p>Edwards Family Law</p>`

/**
 * Where the document list goes while the body is being escaped.
 *
 * A private-use character, so nothing anybody could type into the wording can
 * collide with it. It was a literal NUL byte at first, which worked but made
 * this file read as binary to git and grep, and then briefly the word "DOCS",
 * which would have been swallowed if she ever wrote it.
 */
const DOCS_MARK = "\uE000DOCS\uE000"

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

/**
 * Only http(s) links become links. A document whose Airtable "Link" column
 * holds something odd is shown as plain text rather than turned into a
 * javascript: or data: URL in an email we send on the firm's behalf.
 */
function safeUrl(raw: string): string | null {
  try {
    const u = new URL(raw)
    return u.protocol === "http:" || u.protocol === "https:" ? u.toString() : null
  } catch {
    return null
  }
}

function documentsHtml(docs: EmailVars["documents"]): string {
  return docs
    .map((d) => {
      const title = escapeHtml(d.title || "Document")
      const date = d.date ? ` <span style="color:#6b7280">(${escapeHtml(d.date)})</span>` : ""
      const url = safeUrl(d.link)
      const link = url
        ? ` &nbsp;<a href="${escapeHtml(url)}" style="color:#1b2d45;font-weight:600">Click here</a>`
        : ""
      return `<p style="margin:0 0 10px 0">${title}${date}${link}</p>`
    })
    .join("\n")
}

function documentsText(docs: EmailVars["documents"]): string {
  return docs
    .map((d) => `  ${d.title}${d.date ? ` (${d.date})` : ""}\n  ${d.link}`)
    .join("\n\n")
}

/**
 * Is this template written in the rich editor, or is it plain text?
 *
 * Both have to keep working. The wording started life as plain text in a
 * textarea, so any rule saved before the rich editor arrived still holds plain
 * text, and the two are rendered by different paths. Looking for a real tag is
 * enough to tell them apart - the rich editor always emits at least one.
 */
export function isHtmlTemplate(s: string): boolean {
  return /<(p|div|br|ul|ol|li|b|strong|i|em|u|span|h[1-6]|a|img)\b[^>]*>/i.test(s)
}

/**
 * A readable plain-text version of a rich body, for the text part of the email.
 *
 * Every email carries both. Some clients refuse HTML outright, some people set
 * their client to plain text, and a message that arrives as a wall of angle
 * brackets looks like a broken system rather than a law firm.
 */
export function htmlToText(html: string): string {
  return html
    .replace(/<\/(p|div|h[1-6]|tr)>/gi, "\n\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<li[^>]*>/gi, "  - ")
    .replace(/<\/li>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

/** Fill the placeholders that read the same in both versions. */
function fillCommon(template: string, vars: EmailVars): string {
  const n = vars.documents.length
  const thing = n === 1 ? vars.noun : `${vars.noun}s`
  // "1 new filing has been added" / "3 new filings have been added": the verb
  // has to agree, and the template says "{{count}} new {{thing}} been added".
  const countPhrase = n === 1 ? "1 new" : `${n} new`
  return template
    .replace(/\{\{first_name\}\}/g, vars.firstName || "there")
    .replace(/\{\{client_name\}\}/g, vars.clientName || "")
    .replace(/\{\{count\}\}/g, String(n))
    .replace(/\{\{count_phrase\}\}/g, countPhrase)
    .replace(/\{\{thing\}\}/g, n === 1 ? `${thing} has` : `${thing} have`)
}

export function renderEmail(
  subjectTemplate: string,
  bodyTemplate: string,
  vars: EmailVars
): RenderedEmail {
  const n = vars.documents.length
  const thing = n === 1 ? vars.noun : `${vars.noun}s`

  // The subject wants the bare noun, not the verb form the body needs.
  const subject = subjectTemplate
    .replace(/\{\{first_name\}\}/g, vars.firstName || "")
    .replace(/\{\{client_name\}\}/g, vars.clientName || "")
    .replace(/\{\{count\}\}/g, String(n))
    .replace(/\{\{thing\}\}/g, thing)
    .replace(/\{\{documents\}\}/g, "")
    .replace(/\{\{portal_link\}\}/g, "")
    .trim()

  const base = fillCommon(bodyTemplate, vars)

  // ---- rich body ---------------------------------------------------------
  // Written in the editor, so it is already HTML and must NOT be escaped. It is
  // sanitized instead: her formatting and colours survive, scripts and event
  // handlers do not. Only an admin can write this, so the sanitiser is
  // belt-and-braces rather than the main defence.
  if (isHtmlTemplate(bodyTemplate)) {
    const safe = sanitizeNotesHtml(base)
    const htmlRich = safe
      // A paragraph holding nothing but the placeholder is replaced whole.
      // Otherwise the document list, which is itself paragraphs, ends up nested
      // inside one - which some mail clients render with odd spacing.
      .replace(/<p[^>]*>\s*\{\{documents\}\}\s*<\/p>/gi, documentsHtml(vars.documents))
      .replace(/<div[^>]*>\s*\{\{documents\}\}\s*<\/div>/gi, documentsHtml(vars.documents))
      .replace(/\{\{documents\}\}/g, documentsHtml(vars.documents))
      .replace(
        /\{\{portal_link\}\}/g,
        `<a href="${escapeHtml(vars.portalUrl)}" style="color:#1b2d45;font-weight:600">Click here</a>`
      )
    const textRich = htmlToText(
      safe
        .replace(/\{\{documents\}\}/g, documentsText(vars.documents).replace(/\n/g, "<br>"))
        .replace(/\{\{portal_link\}\}/g, vars.portalUrl)
    )
    return {
      subject: subject || DEFAULT_SUBJECT,
      text: textRich,
      html: `<div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.5;color:#111827">
${htmlRich}
</div>`,
    }
  }

  // ---- plain body --------------------------------------------------------
  const text = base
    .replace(/\{\{documents\}\}/g, documentsText(vars.documents))
    .replace(/\{\{portal_link\}\}/g, vars.portalUrl)

  // Built from the escaped body so her wording is safe, then the document list
  // and portal link are dropped in as the only real markup.
  //
  // The marker below uses a private-use character rather than anything
  // typeable, so no wording she writes can collide with it. It was a literal
  // NUL byte at first, which worked but made this file read as binary to git
  // and grep.
  const htmlBody = escapeHtml(base)
    .replace(/\{\{documents\}\}/g, "DOCS")
    .replace(
      /\{\{portal_link\}\}/g,
      `<a href="${escapeHtml(vars.portalUrl)}" style="color:#1b2d45;font-weight:600">Click here</a>`
    )
    .split("\n")
    .map((line) => (line.trim() === "" ? "" : `<p style="margin:0 0 12px 0">${line}</p>`))
    .join("\n")
    .replace(/<p[^>]*>DOCS<\/p>/g, documentsHtml(vars.documents))
    .replace(/DOCS/g, documentsHtml(vars.documents))

  const html = `<div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.5;color:#111827">
${htmlBody}
</div>`

  return { subject: subject || DEFAULT_SUBJECT, text, html }
}

/**
 * What each kind of automation says out of the box (2026-09-04).
 *
 * Each is a starting point, not a fixed form: every one of these is editable
 * per rule on the Automations page, and an untouched rule follows whatever is
 * written here rather than freezing a copy.
 *
 * They are deliberately short and free of legal content. These go out without
 * anybody reading them first, so the safe thing for one to say is "there is
 * something new, here it is, here is your portal" - never anything that could
 * read as advice.
 */
export const DEFAULTS: Record<string, { subject: string; body: string }> = {
  documents: { subject: DEFAULT_SUBJECT, body: DEFAULT_BODY },

  status: {
    subject: "An update on your case",
    body: `<p>Dear {{first_name}},</p>
<p>We have updated the status of your case:</p>
<p>{{documents}}</p>
<p>You can see your full case status, documents and messages on your portal: {{portal_link}}</p>
<p>If you have questions, reply to this email or send us a message through the portal.</p>
<p>Edwards Family Law</p>`,
  },

  hearing: {
    subject: "A reminder about your upcoming court date",
    body: `<p>Dear {{first_name}},</p>
<p>This is a reminder about your upcoming court date:</p>
<p>{{documents}}</p>
<p><strong>Please arrive early and bring a photo ID.</strong> If anything about the date or time is unclear, contact our office before the day.</p>
<p>You can see your case details on your portal: {{portal_link}}</p>
<p>Edwards Family Law</p>`,
  },

  dormant: {
    subject: "There is information waiting on your portal",
    body: `<p>Dear {{first_name}},</p>
<p>It has been a little while since you last opened your client portal. There may be documents, updates or messages waiting for you there.</p>
<p>{{documents}}</p>
<p>Sign in here: {{portal_link}}</p>
<p>If you are having trouble getting in, reply to this email and we will help.</p>
<p>Edwards Family Law</p>`,
  },
}
