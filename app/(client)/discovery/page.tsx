// app/(client)/discovery/page.tsx
import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { getClientByEmail } from "@/lib/airtable"
import AirtableEmbed from "@/components/ui/AirtableEmbed"
import PageHeader from "@/components/ui/PageHeader"
import { getPageContent } from "@/lib/page-content"

export default async function DiscoveryPage() {
  const session = await auth()
  if (!session?.user?.email) redirect("/login")
  const client = await getClientByEmail(session.user.email)
  if (!client) redirect("/login")

  const pageContent = await getPageContent(client.clientId, "discovery")

  return (
    <div className="space-y-6">
      <PageHeader defaultTitle="Discovery" header={pageContent.header} announcement={pageContent.announcement} />
      <AirtableEmbed url={client.discoveryViewLink} title="Discovery" />
    </div>
  )
}
