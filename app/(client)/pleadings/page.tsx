// app/(client)/pleadings/page.tsx
import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { getPortalClient } from "@/lib/portal-client"
import AirtableEmbed from "@/components/ui/AirtableEmbed"
import PageHeader from "@/components/ui/PageHeader"
import { getPageContent } from "@/lib/page-content"

export default async function PleadingsPage() {
  const session = await auth()
  if (!session?.user?.email) redirect("/login")
  const client = await getPortalClient()
  if (!client) redirect("/login")

  const pageContent = await getPageContent(client.clientId, "pleadings")

  return (
    <div className="space-y-6">
      <PageHeader defaultTitle="Pleadings" page="pleadings" content={pageContent} />
      <AirtableEmbed url={client.pleadingsViewLink} title="Pleadings" />
    </div>
  )
}
