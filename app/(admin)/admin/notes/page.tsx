// app/(admin)/admin/notes/page.tsx — Field Notes hub: a running log of every
// note across every case, newest first, with search / author / case filters.
// Admin layout gates auth; notes themselves are served only through admin-only
// code paths.
import Link from "next/link"
import { redirect } from "next/navigation"
import PageTitle from "@/components/ui/PageTitle"
import CaseJump from "@/components/notes/CaseJump"
import { taglineFor } from "@/lib/taglines"
import { fetchAllClientsRaw, clientDisplayLabel } from "@/lib/airtable"
import { getClientLabels } from "@/lib/client-labels"
import { requireAdmin } from "@/lib/admin"
import { latestNoteByClient, searchNotes, listNoteAuthors, countNotes, type NoteSearchHit } from "@/lib/notes"
import { fetchAllEvents, clientProseName, type TimelineEvent } from "@/lib/notes-timeline"

const EVENT_ICONS: Record<string, string> = { chat: "💬", message: "💬", upload: "📎", form: "📋", task: "✅", view: "👁️" }

// What the "Show" filter offers. Field notes are their own kind so the log can
// be narrowed back to just the written record.
const KINDS: { key: string; label: string; match: (e: TimelineEvent) => boolean }[] = [
  { key: "", label: "All activity", match: () => true },
  { key: "notes", label: "Field notes only", match: () => false },
  { key: "messages", label: "Messages", match: (e) => e.kind === "chat" || e.kind === "message" },
  { key: "files", label: "Files", match: (e) => e.kind === "upload" || e.kind === "view" },
  { key: "forms", label: "Forms & tasks", match: (e) => e.kind === "form" || e.kind === "task" },
]

type LogRow =
  | { type: "note"; at: string; clientId: string; key: string; note: NoteSearchHit }
  | { type: "event"; at: string; clientId: string; key: string; event: TimelineEvent }

export const dynamic = "force-dynamic"

const PAGE = 50

// "Today" and "Yesterday" read faster than a date when you're scanning the
// top of the log.
function dayHeading(d: string): string {
  const day = new Date(d).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "America/New_York" })
  const today = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "America/New_York" })
  const yesterday = new Date(Date.now() - 86_400_000).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "America/New_York" })
  if (day === today) return "Today"
  if (day === yesterday) return "Yesterday"
  return day
}

function timeOf(d: string): string {
  return new Date(d).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/New_York" })
}

export default async function FieldNotesHub({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; author?: string; case?: string; limit?: string; show?: string }>
}) {
  const check = await requireAdmin()
  if (check.status !== "ok") redirect("/login")

  const { q, author, case: caseId, limit, show } = await searchParams
  const query = (q ?? "").trim()
  const writer = (author ?? "").trim()
  const forCase = (caseId ?? "").trim()
  const kind = KINDS.some((k) => k.key === (show ?? "")) ? (show ?? "") : ""
  const shown = Math.min(Math.max(Number(limit) || PAGE, PAGE), 500)

  // A failed read must show an explicit error, never a false "nothing here",
  // so carry the outcome rather than flattening it to an empty list.
  const [clients, labels, latest, authors, logResult, total] = await Promise.all([
    fetchAllClientsRaw().catch(() => []),
    getClientLabels().catch(() => ({}) as Record<string, string>),
    latestNoteByClient().catch(() => new Map<string, { snippet: string; created_at: string; author_name: string | null }>()),
    listNoteAuthors().catch(() => [] as string[]),
    // Notes are capped generously: the merged log is trimmed after sorting.
    searchNotes(query, writer, forCase, 500)
      .then((rows) => ({ ok: true, rows }))
      .catch(() => ({ ok: false, rows: [] as NoteSearchHit[] })),
    countNotes().catch(() => 0),
  ])
  const notesFailed = !logResult.ok

  const labelOf = (id: string, fallbackName?: string) =>
    labels[id] || (fallbackName ? clientDisplayLabel(fallbackName) : "") || id

  const cases = clients
    .filter((c) => c.clientId)
    .map((c) => ({
      id: String(c.clientId),
      label: labelOf(String(c.clientId), c.name),
      hasNotes: latest.has(String(c.clientId)),
    }))
    .sort((a, b) => a.label.localeCompare(b.label))

  const filtered = Boolean(query || writer || forCase || kind)
  const caseLabel = (id: string) => labelOf(id, clients.find((c) => String(c.clientId) === id)?.name)

  // Portal activity across every case. The "written by" filter is about who
  // wrote a note, so it excludes events; so does "field notes only".
  const wantsEvents = !writer && kind !== "notes"
  const nameOf = (id: string) =>
    clientProseName(clients.find((c) => String(c.clientId) === id)?.name) || labels[id] || ""
  const events = wantsEvents ? await fetchAllEvents(nameOf).catch(() => [] as TimelineEvent[]) : []

  const kindMatch = KINDS.find((k) => k.key === kind) ?? KINDS[0]
  const eventRows: LogRow[] = events
    .filter((e) => e.clientId)
    .filter((e) => !forCase || e.clientId === forCase)
    .filter((e) => (kind ? kindMatch.match(e) : true))
    .filter((e) => !query || e.detail.toLowerCase().includes(query.toLowerCase()) || caseLabel(e.clientId!).toLowerCase().includes(query.toLowerCase()))
    .map((e) => ({ type: "event" as const, at: e.at, clientId: e.clientId!, key: e.id, event: e }))

  const noteRows: LogRow[] = logResult.rows.map((n) => ({
    type: "note" as const,
    at: n.created_at,
    clientId: n.clientId,
    key: `note-${n.noteId}`,
    note: n,
  }))

  const merged = [...noteRows, ...eventRows]
    .sort((a, b) => {
      const t = new Date(b.at).getTime() - new Date(a.at).getTime()
      return t !== 0 ? t : b.key.localeCompare(a.key)
    })
  const log = merged.slice(0, shown)

  // Group the log by day so it reads like a log book rather than a flat list.
  const days: { heading: string; entries: LogRow[] }[] = []
  for (const entry of log) {
    const heading = dayHeading(entry.at)
    const last = days[days.length - 1]
    if (last && last.heading === heading) last.entries.push(entry)
    else days.push({ heading, entries: [entry] })
  }

  const params = new URLSearchParams()
  if (query) params.set("q", query)
  if (writer) params.set("author", writer)
  if (forCase) params.set("case", forCase)
  if (kind) params.set("show", kind)
  params.set("limit", String(shown + PAGE))

  return (
    <div className="space-y-6 max-w-6xl">
      <PageTitle title="Field Notes" tagline={taglineFor("admin:notes")} />

      <form method="GET" action="/admin/notes" className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          name="q"
          defaultValue={query}
          placeholder="Search every note…"
          className="flex-1 min-w-[14rem] px-4 py-2.5 text-sm bg-white border border-gray-300 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {authors.length > 0 && (
          <select
            name="author"
            defaultValue={writer}
            aria-label="Written by"
            className="px-3 py-2.5 text-sm bg-white border border-gray-300 rounded-xl text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Written by anyone</option>
            {authors.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        )}
        <select
          name="show"
          defaultValue={kind}
          aria-label="Show"
          className="px-3 py-2.5 text-sm bg-white border border-gray-300 rounded-xl text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {KINDS.map((k) => <option key={k.key} value={k.key}>{k.label}</option>)}
        </select>
        <select
          name="case"
          defaultValue={forCase}
          aria-label="Case"
          className="px-3 py-2.5 text-sm bg-white border border-gray-300 rounded-xl text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 max-w-[14rem]"
        >
          <option value="">Any case</option>
          {cases.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
        </select>
        <button type="submit" className="px-4 py-2.5 rounded-xl text-white text-sm font-semibold hover:opacity-90" style={{ background: "#1b2d45" }}>
          Search
        </button>
        {filtered && (
          <Link href="/admin/notes" className="text-sm text-gray-400 hover:text-gray-700 underline">Clear</Link>
        )}
      </form>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        <div className="lg:col-span-2 space-y-3">
          <div className="flex items-baseline gap-3 flex-wrap">
            <p className="section-label">
              {filtered ? "Matching activity" : "Running log — every case"}
            </p>
            <span className="text-xs text-gray-400">
              {log.length} of {merged.length} {merged.length === 1 ? "entry" : "entries"}
              {!filtered && total > 0 && ` · ${total} ${total === 1 ? "note" : "notes"}`}
              {writer && ` · notes by ${writer}`}
              {forCase && ` · ${caseLabel(forCase)}`}
              {kind && ` · ${kindMatch.label.toLowerCase()}`}
            </span>
          </div>

          {notesFailed && (
            <p className="text-sm text-red-600 bg-white rounded-xl border border-red-200 p-4">
              The log couldn&apos;t be loaded right now — refresh to try again.
            </p>
          )}

          {!notesFailed && log.length === 0 && (
            <p className="text-sm text-gray-500 bg-white rounded-xl border border-gray-200 p-6">
              {filtered ? "Nothing matches those filters." : "No activity yet — open a case and write the first note."}
            </p>
          )}

          {days.map((day) => (
            <div key={day.heading} className="space-y-2">
              <p className="text-[11px] uppercase tracking-wider text-gray-400 pt-1">{day.heading}</p>
              <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
                {day.entries.map((entry) =>
                  entry.type === "note" ? (
                    // Written notes are the important entries: navy edge, like
                    // the per-case timeline.
                    <Link
                      key={entry.key}
                      href={`/admin/notes/${encodeURIComponent(entry.clientId)}`}
                      className="block px-5 py-3.5 hover:bg-gray-50"
                      style={{ borderLeft: "3px solid #1b2d45" }}
                    >
                      <p className="flex items-baseline justify-between gap-3">
                        <span className="text-sm font-semibold text-gray-900 truncate">📌 {caseLabel(entry.clientId)}</span>
                        <span className="shrink-0 text-xs text-gray-400">
                          {timeOf(entry.at)}{entry.note.author_name && ` · ${entry.note.author_name}`}
                        </span>
                      </p>
                      <p className="text-sm text-gray-600 mt-0.5">{entry.note.snippet}</p>
                    </Link>
                  ) : (
                    <div key={entry.key} className="px-5 py-2.5 hover:bg-gray-50" style={{ borderLeft: "3px solid transparent" }}>
                      <p className="flex items-baseline justify-between gap-3">
                        <Link href={`/admin/notes/${encodeURIComponent(entry.clientId)}`} className="text-sm font-semibold text-gray-700 truncate hover:underline">
                          {EVENT_ICONS[entry.event.kind] ?? "•"} {caseLabel(entry.clientId)}
                        </Link>
                        <span className="shrink-0 text-xs text-gray-400">{timeOf(entry.at)}</span>
                      </p>
                      <p className="text-[13px] text-gray-600 mt-0.5">
                        {entry.event.detail}
                        {entry.event.href && (
                          <a href={entry.event.href} target="_blank" rel="noreferrer" className="ml-2 text-blue-600 underline hover:text-blue-800">
                            {entry.event.linkLabel ?? "Open file"}
                          </a>
                        )}
                      </p>
                    </div>
                  )
                )}
              </div>
            </div>
          ))}

          {merged.length > log.length && (
            <Link href={`/admin/notes?${params.toString()}`} className="inline-block text-sm underline text-gray-600 hover:text-gray-900">
              Show older notes
            </Link>
          )}
        </div>

        <aside className="space-y-3 lg:sticky lg:top-4">
          <CaseJump cases={cases} />
          {!filtered && total > 0 && (
            <p className="text-xs text-gray-400 px-1">
              Notes from every case appear here as they&apos;re written. Use the filters above to narrow the log, or
              open a case to write one.
            </p>
          )}
        </aside>
      </div>
    </div>
  )
}
