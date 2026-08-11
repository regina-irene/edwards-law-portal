// app/(admin)/admin/notes/page.tsx — Field Notes hub: every client A→Z with
// their latest note, plus search across all notes. Admin layout gates auth;
// notes themselves are served only through admin-only code paths.
import Link from "next/link"
import { redirect } from "next/navigation"
import PageTitle from "@/components/ui/PageTitle"
import { taglineFor } from "@/lib/taglines"
import { fetchAllClientsRaw, clientDisplayLabel } from "@/lib/airtable"
import { getClientLabels } from "@/lib/client-labels"
import { requireAdmin } from "@/lib/admin"
import { latestNoteByClient, searchNotes, listNoteAuthors } from "@/lib/notes"

export const dynamic = "force-dynamic"

function fmtDate(d: string): string {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "America/New_York" })
}

export default async function FieldNotesHub({ searchParams }: { searchParams: Promise<{ q?: string; author?: string }> }) {
  const check = await requireAdmin()
  if (check.status !== "ok") redirect("/login")

  const { q, author } = await searchParams
  const query = (q ?? "").trim()
  const writer = (author ?? "").trim()

  let notesFailed = false
  const [clients, labels, latest, authors, results] = await Promise.all([
    fetchAllClientsRaw().catch(() => []),
    getClientLabels().catch(() => ({}) as Record<string, string>),
    latestNoteByClient().catch(() => { notesFailed = true; return new Map<string, { snippet: string; created_at: string; author_name: string | null }>() }),
    listNoteAuthors().catch(() => [] as string[]),
    query || writer ? searchNotes(query, writer).catch(() => []) : Promise.resolve([]),
  ])

  const labelOf = (id: string, fallbackName?: string) =>
    labels[id] || (fallbackName ? clientDisplayLabel(fallbackName) : "") || id

  const rows = clients
    .filter((c) => c.clientId)
    .map((c) => ({ id: String(c.clientId), label: labelOf(String(c.clientId), c.name) }))
    .sort((a, b) => a.label.localeCompare(b.label))

  return (
    <div className="space-y-6 max-w-3xl">
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
            className="px-3 py-2.5 text-sm bg-white border border-gray-300 rounded-xl text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Written by anyone</option>
            {authors.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        )}
        <button type="submit" className="px-4 py-2.5 rounded-xl text-white text-sm font-semibold hover:opacity-90" style={{ background: "#1b2d45" }}>
          Search
        </button>
      </form>

      {(query || writer) && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
          <p className="section-label">
            {query ? `Search results for “${query}”` : "All notes"}
            {writer && ` written by ${writer}`}
          </p>
          {results.length === 0 && <p className="text-sm text-gray-500">No notes match.</p>}
          {results.map((r) => (
            <Link key={r.noteId} href={`/admin/notes/${encodeURIComponent(r.clientId)}`} className="block hover:bg-gray-50 rounded-lg p-2 -m-2">
              <p className="text-sm font-semibold text-gray-900">
                {labelOf(r.clientId, clients.find((c) => String(c.clientId) === r.clientId)?.name)}
                <span className="font-normal text-gray-400"> · {fmtDate(r.created_at)}{r.author_name && ` · ${r.author_name}`}</span>
              </p>
              <p className="text-sm text-gray-600">{r.snippet}</p>
            </Link>
          ))}
        </div>
      )}

      {notesFailed && <p className="text-sm text-red-600">Latest-note previews couldn&apos;t be loaded right now.</p>}

      <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
        {rows.map((r) => {
          const note = latest.get(r.id)
          return (
            <Link key={r.id} href={`/admin/notes/${encodeURIComponent(r.id)}`} className="flex items-baseline justify-between gap-4 px-5 py-3.5 hover:bg-gray-50">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-900">{r.label}</p>
                <p className="text-sm text-gray-500 truncate">{notesFailed ? "" : note ? note.snippet : "No notes yet"}</p>
              </div>
              {note && (
                <span className="shrink-0 text-xs text-gray-400">
                  {fmtDate(note.created_at)}{note.author_name && ` · ${note.author_name}`}
                </span>
              )}
            </Link>
          )
        })}
        {rows.length === 0 && <p className="px-5 py-6 text-sm text-gray-500">No clients found (Airtable may be unreachable) — try again shortly.</p>}
      </div>
    </div>
  )
}
