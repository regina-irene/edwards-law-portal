// components/status/StatusHistory.tsx - the client's record of every status
// update they've been given (2026-08-18).
//
// Deliberately NOT the firm's field notes: those are the private case log and
// are admin-only. This shows only the words the client was actually shown, and
// when, so they can look back at what they were told.
import { type StatusHistoryEntry } from "@/lib/status-history"
import { fullStamp, relativeDay } from "@/lib/dates"
import { RichTextView } from "@/components/ui/RichTextView"
import { sanitizeNotesHtml } from "@/lib/sanitize"

export default function StatusHistory({ entries }: { entries: StatusHistoryEntry[] }) {
  // The newest entry is what the card above already shows, so start at the
  // second - this section is the history, not a repeat.
  const past = entries.slice(1)
  if (past.length === 0) return null

  return (
    <details className="bg-white rounded-lg border border-gray-200 p-4 print:open">
      <summary className="cursor-pointer text-xs uppercase tracking-wide font-semibold" style={{ color: "#1b2d45" }}>
        Earlier updates ({past.length})
      </summary>
      <ol className="mt-4 space-y-4">
        {past.map((e) => (
          <li key={e.at} className="border-l-2 pl-3" style={{ borderColor: "#E8DFD2" }}>
            <p className="text-xs text-gray-500">
              {relativeDay(e.at)} · {fullStamp(e.at)}
            </p>
            {e.statusHtml ? (
              <div className="mt-1">
                <RichTextView html={sanitizeNotesHtml(e.statusHtml)} className="text-gray-800" />
              </div>
            ) : e.statusText ? (
              <p className="mt-1 text-sm text-gray-800 whitespace-pre-wrap">{e.statusText}</p>
            ) : (
              <p className="mt-1 text-sm text-gray-400 italic">No written update at this point.</p>
            )}
          </li>
        ))}
      </ol>
    </details>
  )
}
