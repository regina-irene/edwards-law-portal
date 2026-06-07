// app/(client)/discovery/page.tsx
import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { getPortalClient } from "@/lib/portal-client"
import AirtableEmbed from "@/components/ui/AirtableEmbed"
import PageHeader from "@/components/ui/PageHeader"
import { getPageContent } from "@/lib/page-content"

export default async function DiscoveryPage() {
  const session = await auth()
  if (!session?.user?.email) redirect("/login")
  const client = await getPortalClient()
  if (!client) redirect("/login")

  const pageContent = await getPageContent(client.clientId, "discovery")

  return (
    <div className="space-y-6">
      <PageHeader defaultTitle="Discovery" page="discovery" content={pageContent} />
      <AirtableEmbed url={client.discoveryViewLink} title="Discovery" />
    </div>
  )
}
