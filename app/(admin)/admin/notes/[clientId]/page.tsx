// app/(admin)/admin/notes/[clientId]/page.tsx - one client's Field Notes
// timeline: manual notes merged with live portal events, newest first.
import Link from "next/link"
import { redirect } from "next/navigation"
import PageTitle from "@/components/ui/PageTitle"
import PrintButton from "@/components/ui/PrintButton"
import NotesTimeline from "@/components/notes/NotesTimeline"
import { fetchAllClientsRaw, clientDisplayLabel } from "@/lib/airtable"
import { getClientLabels } from "@/lib/client-labels"
import { requireAdmin } from "@/lib/admin"
import { listNotes, type ClientNote } from "@/lib/notes"
import { fetchClientEvents, mergeTimeline, clientProseName } from "@/lib/notes-timeline"
import { getHiddenEventIds } from "@/lib/hidden-events"

export const dynamic = "force-dynamic"

export default async function ClientFieldNotes({ params }: { params: Promise<{ clientId: string }> }) {
  const check = await requireAdmin()
  if (check.status !== "ok") redirect("/login")

  const { clientId } = await params
  const cid = decodeURIComponent(clientId)

  let notesFailed = false
  const [notes, clients, labels] = await Promise.all([
    listNotes(cid).catch(() => { notesFailed = true; return [] as ClientNote[] }),
    fetchAllClientsRaw().catch(() => []),
    getClientLabels().catch(() => ({}) as Record<string, string>),
  ])

  const client = clients.find((c) => String(c.clientId) === cid)
  const label = labels[cid] || (client ? clientDisplayLabel(client.name) : cid)
  // Entries read "Client Cleon Grey uploaded …" - the person, not a role. The
  // Airtable name reads best in prose; fall back to whatever label we have.
  const proseName = clientProseName(client?.name) || labels[cid] || ""
  const events = await fetchClientEvents(cid, proseName)
  const items = mergeTimeline(notes, events)
  // Activity the firm has taken off the log. Passed down rather than filtered
  // here so the timeline can offer "Show hidden" without another round trip;
  // nothing was deleted, so every one of these can come back.
  const hiddenEventIds = [...(await getHiddenEventIds())]

  return (
    <div className="space-y-6">
      <PageTitle
        title={label}
        tagline="Field Notes - your private case log; clients never see this"
        actions={
          <span className="flex items-center gap-3 print:hidden">
            <Link href="/admin/notes" className="text-sm underline text-gray-500 hover:text-gray-900">← All clients</Link>
            <PrintButton />
          </span>
        }
      />
      <NotesTimeline
        clientId={cid}
        initialItems={items}
        loadError={notesFailed}
        hiddenEventIds={hiddenEventIds}
      />
    </div>
  )
}
