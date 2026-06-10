// app/(client)/pleadings/page.tsx
import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { getPortalClient } from "@/lib/portal-client"
import AirtableEmbed from "@/components/ui/AirtableEmbed"
import PageHeader from "@/components/ui/PageHeader"
import { getPageContent } from "@/lib/page-content"
import { getPleadings } from "@/lib/pleadings"
import PleadingsList from "@/components/pleadings/PleadingsList"

export default async function PleadingsPage() {
  const session = await auth()
  if (!session?.user?.email) redirect("/login")
  const client = await getPortalClient()
  if (!client) redirect("/login")

  const [pageContent, docs] = await Promise.all([
    getPageContent(client.clientId, "pleadings"),
    getPleadings(client.clientBaseId),
  ])

  return (
    <div className="space-y-6">
      <PageHeader defaultTitle="Pleadings" page="pleadings" content={pageContent} />
      {/* Docket-style list replaces the embed; if this client's base can't be
          read (docs === null) fall back to the old embed so nothing breaks. */}
      {docs ? <PleadingsList docs={docs} /> : <AirtableEmbed url={client.pleadingsViewLink} title="Pleadings" />}
    </div>
  )
}
