// app/(admin)/admin/notes/page.tsx — Field Notes hub: every client A→Z with
// their latest note, plus search across all notes. Admin layout gates auth;
// notes themselves are served only through admin-only code paths.
import Link from "next/link"
import PageTitle from "@/components/ui/PageTitle"
import { taglineFor } from "@/lib/taglines"
import { fetchAllClientsRaw, clientDisplayLabel } from "@/lib/airtable"
import { getClientLabels } from "@/lib/client-labels"
import { latestNoteByClient, searchNotes } from "@/lib/notes"

export const dynamic = "force-dynamic"

function fmtDate(d: string): string {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "America/New_York" })
}

export default async function FieldNotesHub({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams
  const query = (q ?? "").trim()

  const [clients, labels, latest, results] = await Promise.all([
    fetchAllClientsRaw().catch(() => []),
    getClientLabels().catch(() => ({}) as Record<string, string>),
    latestNoteByClient().catch(() => new Map<string, { snippet: string; created_at: string }>()),
    query ? searchNotes(query).catch(() => []) : Promise.resolve([]),
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

      <form method="GET" action="/admin/notes">
        <input
          type="search"
          name="q"
          defaultValue={query}
          placeholder="Search every note…"
          className="w-full px-4 py-2.5 text-sm bg-white border border-gray-300 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </form>

      {query && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
          <p className="section-label">Search results for “{query}”</p>
          {results.length === 0 && <p className="text-sm text-gray-500">No notes match.</p>}
          {results.map((r) => (
            <Link key={r.noteId} href={`/admin/notes/${encodeURIComponent(r.clientId)}`} className="block hover:bg-gray-50 rounded-lg p-2 -m-2">
              <p className="text-sm font-semibold text-gray-900">{labelOf(r.clientId)} <span className="font-normal text-gray-400">· {fmtDate(r.created_at)}</span></p>
              <p className="text-sm text-gray-600">{r.snippet}</p>
            </Link>
          ))}
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
        {rows.map((r) => {
          const note = latest.get(r.id)
          return (
            <Link key={r.id} href={`/admin/notes/${encodeURIComponent(r.id)}`} className="flex items-baseline justify-between gap-4 px-5 py-3.5 hover:bg-gray-50">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-900">{r.label}</p>
                <p className="text-sm text-gray-500 truncate">{note ? note.snippet : "No notes yet"}</p>
              </div>
              {note && <span className="shrink-0 text-xs text-gray-400">{fmtDate(note.created_at)}</span>}
            </Link>
          )
        })}
        {rows.length === 0 && <p className="px-5 py-6 text-sm text-gray-500">No clients found (Airtable may be unreachable) — try again shortly.</p>}
      </div>
    </div>
  )
}
