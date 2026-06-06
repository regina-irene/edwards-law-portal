// app/(client)/calendar/page.tsx
import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { getPortalClient } from "@/lib/portal-client"
import AirtableEmbed from "@/components/ui/AirtableEmbed"
import PageHeader from "@/components/ui/PageHeader"
import { getPageContent } from "@/lib/page-content"

export default async function CalendarPage() {
  const session = await auth()
  if (!session?.user?.email) redirect("/login")
  const client = await getPortalClient()
  if (!client) redirect("/login")

  const pageContent = await getPageContent(client.clientId, "calendar")

  return (
    <div className="space-y-6">
      <PageHeader defaultTitle="Calendar" header={pageContent.header} announcement={pageContent.announcement} />
      <AirtableEmbed url={client.calendarViewLink} title="Calendar" />
    </div>
  )
}
