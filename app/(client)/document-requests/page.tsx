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

  // FileFlow logs the client in via a cookie, which browsers block inside an
  // iframe — so open those links in a new tab instead of embedding.
  const isLoginApp = !!url && /edwardsfamilylaw\.com|fileflow|launchbay/i.test(url)

  // Render header/announcement/body/image, but not the embed twice.
  const headerContent = { ...pageContent, embed_url: null }

  return (
    <div className="space-y-6">
      <PageHeader defaultTitle="Document Requests" page="document-requests" content={headerContent} />
      {!url ? (
        <div className="flex items-center justify-center h-64 bg-gray-50 rounded-lg border border-gray-200">
          <p className="text-sm text-gray-500">Document portal not configured. Please contact your attorney.</p>
        </div>
      ) : isLoginApp ? (
        <div className="flex flex-col items-center justify-center gap-4 py-16 bg-gray-50 rounded-lg border border-gray-200">
          <p className="text-gray-600 text-center max-w-sm">
            Your secure document portal opens in a new tab, where you can upload and manage requested documents.
          </p>
          <a href={url} target="_blank" rel="noopener noreferrer" className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors">
            Open Document Portal ↗
          </a>
        </div>
      ) : (
        <AirtableEmbed url={url} title="Document Portal" height={pageContent.embed_height ?? undefined} />
      )}
    </div>
  )
}
