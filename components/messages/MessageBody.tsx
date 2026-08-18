// components/messages/MessageBody.tsx — the one place a message body is turned
// into markup (2026-08-18). Shared by the admin Message Center, the client
// thread and the printable transcript so all three stay in step.
//
// Plain bodies render with real <br> elements rather than relying on
// white-space: pre-wrap alone. That matters for copy/paste: Word reads the
// clipboard's HTML flavor, and pre-wrap newlines don't exist in it, so a
// pasted thread used to collapse into one run-on paragraph.
//
// HTML bodies are sanitized on the way into the database (see the chat API
// route), and only ever written by an authenticated admin.
import { isHtmlBody } from "@/lib/message-format"

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
        dangerouslySetInnerHTML={{ __html: body }}
      />
    )
  }
  const lines = body.split(/\r?\n/)
  return (
    <p className={`whitespace-pre-wrap break-words ${className}`}>
      {lines.map((line, i) => (
        <span key={i}>
          {line}
          {i < lines.length - 1 && <br />}
        </span>
      ))}
    </p>
  )
}
