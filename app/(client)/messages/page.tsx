// app/(client)/messages/page.tsx — two-way conversation with the firm
import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { getPortalClient } from "@/lib/portal-client"
import PageHeader from "@/components/ui/PageHeader"
import { getPageContent } from "@/lib/page-content"
import ClientThread from "@/components/messages/ClientThread"
import { getPortalArchiveState } from "@/lib/client-write-guard"

export default async function MessagesPage() {
  const session = await auth()
  if (!session?.user?.email) redirect("/login")

  const client = await getPortalClient()
  if (!client) redirect("/login")

  // Resolved on the server and passed down, so the component doesn't have to
  // fetch it. The server routes refuse regardless; this is so the client isn't
  // offered a button that can only fail.
  const [pageContent, archive] = await Promise.all([
    getPageContent(client.clientId, "messages"),
    getPortalArchiveState(client),
  ])

  return (
    <div className="space-y-5">
      <PageHeader defaultTitle="Messages" page="messages" content={pageContent} />
      <ClientThread readOnly={archive.readOnly} />
    </div>
  )
}
