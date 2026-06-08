// app/(client)/document-requests/page.tsx
import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { getPortalClient } from "@/lib/portal-client"
import PageHeader from "@/components/ui/PageHeader"
import AirtableEmbed from "@/components/ui/AirtableEmbed"
import { getPageContent } from "@/lib/page-content"

export default async function DocumentRequestsPage() {
  const session = await auth()
  if (!session?.user?.email) redirect("/login")
  const client = await getPortalClient()
  if (!client) redirect("/login")

  const pageContent = await getPageContent(client.clientId, "document-requests")
  // Embed the page's link override if set, otherwise this client's FileFlow link.
  const url = pageContent.embed_url || client.fileflowLink

  // Render header/announcement/body/image, but not the embed twice.
  const headerContent = { ...pageContent, embed_url: null }

  return (
    <div className="space-y-6">
      <PageHeader defaultTitle="Document Requests" page="document-requests" content={headerContent} />
      {url ? (
        <AirtableEmbed url={url} title="Document Portal" />
      ) : (
        <div className="flex items-center justify-center h-64 bg-gray-50 rounded-lg border border-gray-200">
          <p className="text-sm text-gray-500">Document portal not configured. Please contact your attorney.</p>
        </div>
      )}
    </div>
  )
}
