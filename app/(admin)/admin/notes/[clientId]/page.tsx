// app/(admin)/admin/notes/[clientId]/page.tsx — one client's Field Notes
// timeline: manual notes merged with live portal events, newest first.
import Link from "next/link"
import PageTitle from "@/components/ui/PageTitle"
import PrintButton from "@/components/ui/PrintButton"
import NotesTimeline from "@/components/notes/NotesTimeline"
import { fetchAllClientsRaw, clientDisplayLabel } from "@/lib/airtable"
import { getClientLabels } from "@/lib/client-labels"
import { listNotes } from "@/lib/notes"
import { fetchClientEvents, mergeTimeline } from "@/lib/notes-timeline"

export const dynamic = "force-dynamic"

export default async function ClientFieldNotes({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = await params
  const cid = decodeURIComponent(clientId)

  const [notes, events, clients, labels] = await Promise.all([
    listNotes(cid).catch(() => []),
    fetchClientEvents(cid),
    fetchAllClientsRaw().catch(() => []),
    getClientLabels().catch(() => ({}) as Record<string, string>),
  ])

  const client = clients.find((c) => String(c.clientId) === cid)
  const label = labels[cid] || (client ? clientDisplayLabel(client.name) : cid)
  const items = mergeTimeline(notes, events)

  return (
    <div className="space-y-6">
      <PageTitle
        title={label}
        tagline="Field Notes — your private case log; clients never see this"
        actions={
          <span className="flex items-center gap-3 print:hidden">
            <Link href="/admin/notes" className="text-sm underline text-gray-500 hover:text-gray-900">← All clients</Link>
            <PrintButton />
          </span>
        }
      />
      <NotesTimeline clientId={cid} initialItems={items} />
    </div>
  )
}
