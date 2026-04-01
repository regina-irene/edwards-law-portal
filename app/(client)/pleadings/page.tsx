// app/(client)/pleadings/page.tsx
import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { getClientByEmail } from "@/lib/airtable"
import AirtableEmbed from "@/components/ui/AirtableEmbed"
import PageHeader from "@/components/ui/PageHeader"
import { getPageContent } from "@/lib/page-content"

export default async function PleadingsPage() {
  const session = await auth()
  if (!session?.user?.email) redirect("/login")
  const client = await getClientByEmail(session.user.email)
  if (!client) redirect("/login")

  const pageContent = await getPageContent(client.clientId, "pleadings")

  return (
    <div className="space-y-6">
      <PageHeader defaultTitle="Pleadings" header={pageContent.header} announcement={pageContent.announcement} />
      <AirtableEmbed url={client.pleadingsViewLink} title="Pleadings" />
    </div>
  )
}
