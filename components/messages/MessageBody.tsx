// components/messages/MessageBody.tsx — the one place a message body is turned
// into markup (2026-08-18). Shared by the admin Message Center, the client
// thread and the printable transcript so all three stay in step.
//
// Plain bodies render with real <br> elements rather than relying on
// white-space: pre-wrap alone. That matters for copy/paste: Word reads the
// clipboard's HTML flavor, and pre-wrap newlines don't exist in it, so a
// pasted thread used to collapse into one run-on paragraph.
//
// Bodies are sanitized again at render time. The admin chat route sanitizes on
// write, but client-composed messages (/api/chat) and inbound SMS are stored
// verbatim, and isHtmlBody() sniffs content rather than trusting the sender -
// so without this a client could store markup that runs in the firm's browser.
//
// Bare URLs are turned into real links (2026-08-22). Every other surface that
// shows text already did this through RichTextView, but messages went straight
// to markup and skipped it - so a Drive link or a court e-filing address sent
// to a client arrived as plain text they had to select and copy by hand, which
// is the one place it matters most. linkifyHtml runs AFTER sanitising, walks
// tag by tag, and leaves anchors the editor already made alone, so nothing gets
// double-linked and no href is rewritten.
import { isHtmlBody, plainToHtml } from "@/lib/message-format"
import { linkifyHtml } from "@/lib/linkify"
import { sanitizeNotesHtml } from "@/lib/sanitize"

const RICH =
  "[&_a]:underline [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 " +
  "[&_h2]:text-base [&_h2]:font-bold [&_h3]:text-sm [&_h3]:font-semibold " +
  "[&_img]:max-w-full [&_img]:rounded [&_img]:my-2 [&_p]:my-1 [&_blockquote]:pl-3 " +
  "[&_blockquote]:border-l-2 [&_blockquote]:border-current/30"

export default function MessageBody({ body, className = "" }: { body: string; className?: string }) {
  if (isHtmlBody(body)) {
    return (
      <div
        className={`break-words ${RICH} ${className}`}
        dangerouslySetInnerHTML={{ __html: linkifyHtml(sanitizeNotesHtml(body)) }}
      />
    )
  }

  // Plain bodies: escaped first by plainToHtml, so linkifying and setting this
  // as markup is safe - the only tags that can reach the browser are the <br>
  // it produced and the anchors linkifyHtml added. Real <br> elements are kept
  // for the clipboard reason in the note above.
  return (
    <p
      className={`whitespace-pre-wrap break-words ${RICH} ${className}`}
      dangerouslySetInnerHTML={{ __html: linkifyHtml(plainToHtml(body)) }}
    />
  )
}
