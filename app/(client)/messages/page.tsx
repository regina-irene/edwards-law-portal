// app/(client)/messages/page.tsx — two-way conversation with the firm
import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { getPortalClient } from "@/lib/portal-client"
import PageHeader from "@/components/ui/PageHeader"
import { getPageContent } from "@/lib/page-content"
import ClientThread from "@/components/messages/ClientThread"

export default async function MessagesPage() {
  const session = await auth()
  if (!session?.user?.email) redirect("/login")

  const client = await getPortalClient()
  if (!client) redirect("/login")

  const pageContent = await getPageContent(client.clientId, "messages")

  return (
    <div className="space-y-5">
      <PageHeader defaultTitle="Messages" page="messages" content={pageContent} />
      <ClientThread />
    </div>
  )
}
