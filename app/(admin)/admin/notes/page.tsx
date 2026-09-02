// app/(admin)/admin/notes/page.tsx - Field Notes hub: a running log of every
// note across every case, newest first, with search / author / case filters.
// Admin layout gates auth; notes themselves are served only through admin-only
// code paths.
import Link from "next/link"
import { redirect } from "next/navigation"
import PageTitle from "@/components/ui/PageTitle"
import QuickNote from "@/components/notes/QuickNote"
import LogNoteRow from "@/components/notes/LogNoteRow"
import LogEventRow from "@/components/notes/LogEventRow"
import { dayHeadingWithDate, timeOfDay } from "@/lib/dates"
import CaseJump from "@/components/notes/CaseJump"
import { taglineFor } from "@/lib/taglines"
import { fetchAllClientsRaw, clientDisplayLabel } from "@/lib/airtable"
import { getClientLabels } from "@/lib/client-labels"
import { archiveNotes, noteFor } from "@/lib/admin-archive"
import ArchivedChip from "@/components/admin/ArchivedChip"
import { requireAdmin } from "@/lib/admin"
import { latestNoteByClient, searchNotes, listNoteAuthors, countNotes, type NoteSearchHit } from "@/lib/notes"
import { fetchAllEvents, clientProseName, type TimelineEvent } from "@/lib/notes-timeline"
import { getHiddenEventIds } from "@/lib/hidden-events"

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

// "Today" and "Yesterday" read faster when scanning the top of the log, but
// carry the real date with them - a heading that only says "Today" is useless
// a week later, and worse once printed. (2026-08-18)
/**
 * A file or an outside address opens in a new tab; a page inside the portal
 * does not. Clicking a client's message here is meant to take you TO the
 * conversation to reply, so a new tab would only leave strays behind.
 */
function newTab(href: string): boolean {
  return !href.startsWith("/") || href.startsWith("/api/")
}

const dayHeading = dayHeadingWithDate
const timeOf = timeOfDay

export default async function FieldNotesHub({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; author?: string; case?: string; limit?: string; show?: string; archived?: string; hidden?: string }>
}) {
  const check = await requireAdmin()
  if (check.status !== "ok") redirect("/login")

  const { q, author, case: caseId, limit, show, archived, hidden } = await searchParams
  // Hidden activity is off unless asked for, so the log reads clean by default
  // and nothing is ever gone for good. In the URL so it survives a refresh.
  const showHidden = hidden === "1"
  const query = (q ?? "").trim()
  const writer = (author ?? "").trim()
  const forCase = (caseId ?? "").trim()
  const kind = KINDS.some((k) => k.key === (show ?? "")) ? (show ?? "") : ""
  const shown = Math.min(Math.max(Number(limit) || PAGE, PAGE), 500)
  // Rides along in the same GET form as the other filters, so it survives a
  // refresh and stays put while you page through the log.
  const includeArchived = archived === "1"

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

  // Archived (former) clients drop out of the log and the case picker unless
  // asked for. The label lookups above still cover them, so a row that IS shown
  // never falls back to a raw record id.
  const stamps = await archiveNotes(clients)
  const archivedIds = new Set(clients.filter((c) => c.archived).map((c) => String(c.clientId)))
  const archivedCount = archivedIds.size
  const isArchived = (id: string) => archivedIds.has(id)
  const archiveNoteOf = (id: string) => noteFor(stamps, id).note
  const isHiddenCase = (id: string) => !includeArchived && isArchived(id)

  const cases = clients
    .filter((c) => c.clientId)
    .filter((c) => includeArchived || !c.archived)
    .map((c) => ({
      id: String(c.clientId),
      label: labelOf(String(c.clientId), c.name),
      hasNotes: latest.has(String(c.clientId)),
      archived: c.archived,
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
  // Fails soft to an empty set inside the helper, so a database problem shows
  // MORE activity than it should rather than making entries disappear.
  const hiddenEventIds = await getHiddenEventIds()
  const hiddenOnScreen = events.filter((e) => e.clientId && hiddenEventIds.has(e.id)).length

  const kindMatch = KINDS.find((k) => k.key === kind) ?? KINDS[0]
  const eventRows: LogRow[] = events
    .filter((e) => e.clientId)
    .filter((e) => !isHiddenCase(e.clientId!))
    .filter((e) => !forCase || e.clientId === forCase)
    .filter((e) => (kind ? kindMatch.match(e) : true))
    .filter((e) => !query || e.detail.toLowerCase().includes(query.toLowerCase()) || caseLabel(e.clientId!).toLowerCase().includes(query.toLowerCase()))
    // Entries the firm has taken off the log. Nothing was deleted: the message,
    // file, task or form response is untouched and this line comes straight
    // back with "Show hidden". See lib/hidden-events.
    .filter((e) => showHidden || !hiddenEventIds.has(e.id))
    .map((e) => ({ type: "event" as const, at: e.at, clientId: e.clientId!, key: e.id, event: e }))

  const noteRows: LogRow[] = logResult.rows
    .filter((n) => !isHiddenCase(n.clientId))
    .map((n) => ({
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
  if (includeArchived) params.set("archived", "1")
  params.set("limit", String(shown + PAGE))

  return (
    <div className="space-y-6 max-w-6xl">
      <PageTitle title="Field Notes" tagline={taglineFor("admin:notes")} />

      {/* This page searches every case; the running log for one case lives at
          /admin/notes/[clientId]. Writing used to be possible only from there,
          which meant noticing that a client's name was a link. */}
      <QuickNote clients={cases.map((c) => ({ id: c.id, label: c.label, archived: c.archived }))} />
      <p className="text-xs text-gray-400 -mt-3">
        Searching every case below. Click a client&apos;s name to open their full running log.
      </p>

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
        {/* Submits with the rest of the filters, so ?archived=1 lands in the URL
            and survives a refresh. */}
        <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer select-none" title="Show former and closed cases as well">
          <input
            type="checkbox"
            name="archived"
            value="1"
            defaultChecked={includeArchived}
            className="h-3.5 w-3.5 rounded border-gray-300"
          />
          Include archived
          {archivedCount > 0 && <span className="text-gray-400">({archivedCount})</span>}
        </label>
        {showHidden && <input type="hidden" name="hidden" value="1" />}
        {filtered && (
          <Link href="/admin/notes" className="text-sm text-gray-400 hover:text-gray-700 underline">Clear</Link>
        )}
      </form>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        <div className="lg:col-span-2 space-y-3">
          <div className="flex items-baseline gap-3 flex-wrap">
            <p className="section-label">
              {filtered ? "Matching activity" : "Running log - every case"}
            </p>
            <span className="text-xs text-gray-400">
              {log.length} of {merged.length} {merged.length === 1 ? "entry" : "entries"}
              {!filtered && total > 0 && ` · ${total} ${total === 1 ? "note" : "notes"}`}
              {writer && ` · notes by ${writer}`}
              {forCase && ` · ${caseLabel(forCase)}`}
              {kind && ` · ${kindMatch.label.toLowerCase()}`}
              {!includeArchived && archivedCount > 0 && ` · ${archivedCount} archived ${archivedCount === 1 ? "case" : "cases"} hidden`}
            </span>
            {/* Hiding an entry never deletes anything, so there is always a way
                back to it. The link carries the current filters with it. */}
            {(showHidden || hiddenOnScreen > 0) && (
              <Link
                href={`/admin/notes?${new URLSearchParams({
                  ...(query ? { q: query } : {}),
                  ...(writer ? { author: writer } : {}),
                  ...(forCase ? { case: forCase } : {}),
                  ...(kind ? { show: kind } : {}),
                  ...(includeArchived ? { archived: "1" } : {}),
                  ...(showHidden ? {} : { hidden: "1" }),
                }).toString()}`}
                className="text-xs text-gray-400 hover:text-gray-700 underline print:hidden"
              >
                {showHidden ? "Hide them again" : `Show ${hiddenOnScreen} hidden`}
              </Link>
            )}
          </div>

          {notesFailed && (
            <p className="text-sm text-red-600 bg-white rounded-xl border border-red-200 p-4">
              The log couldn&apos;t be loaded right now - refresh to try again.
            </p>
          )}

          {!notesFailed && log.length === 0 && (
            <p className="text-sm text-gray-500 bg-white rounded-xl border border-gray-200 p-6">
              {filtered ? "Nothing matches those filters." : "No activity yet - open a case and write the first note."}
            </p>
          )}

          {days.map((day) => (
            <div key={day.heading} className="space-y-2">
              <p className="text-[11px] uppercase tracking-wider text-gray-400 pt-1">{day.heading}</p>
              <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
                {day.entries.map((entry) =>
                  entry.type === "note" ? (
                    // Written notes are the important entries: navy edge, like
                    // the per-case timeline. LogNoteRow carries that edge and
                    // the Delete, so the button can sit OUTSIDE the link - a
                    // <button> nested in an <a> is not reliably clickable.
                    <LogNoteRow
                      key={entry.key}
                      noteId={entry.note.noteId}
                      caseLabel={caseLabel(entry.clientId)}
                    >
                      <Link
                        href={`/admin/notes/${encodeURIComponent(entry.clientId)}`}
                        className="block px-5 py-3.5 hover:bg-gray-50"
                      >
                        <p className="flex items-baseline justify-between gap-3">
                          <span className="text-sm font-semibold text-gray-900 truncate">
                            📌 {caseLabel(entry.clientId)}
                            {isArchived(entry.clientId) && <ArchivedChip note={archiveNoteOf(entry.clientId)} className="ml-2" />}
                          </span>
                          {/* Right padding leaves room for the Delete that
                              appears on hover in the same corner. */}
                          <span className="shrink-0 text-xs text-gray-400 pr-14">
                            {timeOf(entry.at)}{entry.note.author_name && ` · ${entry.note.author_name}`}
                          </span>
                        </p>
                        <p className="text-sm text-gray-600 mt-0.5">{entry.note.snippet}</p>
                      </Link>
                    </LogNoteRow>
                  ) : (
                    <LogEventRow
                      key={entry.key}
                      eventId={entry.event.id}
                      hidden={hiddenEventIds.has(entry.event.id)}
                    >
                    <div className="px-5 py-2.5 hover:bg-gray-50" style={{ borderLeft: "3px solid transparent" }}>
                      <p className="flex items-baseline justify-between gap-3">
                        <span className="min-w-0 truncate">
                          <Link href={`/admin/notes/${encodeURIComponent(entry.clientId)}`} className="text-sm font-semibold text-gray-700 hover:underline">
                            {EVENT_ICONS[entry.event.kind] ?? "•"} {caseLabel(entry.clientId)}
                          </Link>
                          {isArchived(entry.clientId) && <ArchivedChip note={archiveNoteOf(entry.clientId)} className="ml-2" />}
                          {hiddenEventIds.has(entry.event.id) && (
                            <span className="ml-2 text-[10px] uppercase tracking-wide text-gray-400">hidden</span>
                          )}
                        </span>
                        {/* Right padding leaves room for the Hide that appears
                            on hover in the same corner. */}
                        <span className="shrink-0 text-xs text-gray-400 pr-12">{timeOf(entry.at)}</span>
                      </p>
                      {/* The entry itself is the link, so a client's message
                          goes straight to the conversation rather than naming
                          something you then have to hunt for. */}
                      <p className="text-[13px] text-gray-600 mt-0.5">
                        {entry.event.href ? (
                          <a
                            href={entry.event.href}
                            {...(newTab(entry.event.href)
                              ? { target: "_blank", rel: "noreferrer" }
                              : {})}
                            className="text-blue-700 hover:underline"
                            title={entry.event.linkLabel ?? "Open"}
                          >
                            {entry.event.detail}
                          </a>
                        ) : (
                          entry.event.detail
                        )}
                      </p>
                    </div>
                    </LogEventRow>
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
