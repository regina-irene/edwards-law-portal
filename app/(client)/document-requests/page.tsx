// app/(client)/document-requests/page.tsx
import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { getPortalClient } from "@/lib/portal-client"
import PageHeader from "@/components/ui/PageHeader"
import { getPageContent } from "@/lib/page-content"

export default async function DocumentRequestsPage() {
  const session = await auth()
  if (!session?.user?.email) redirect("/login")
  const client = await getPortalClient()
  if (!client) redirect("/login")

  const pageContent = await getPageContent(client.clientId, "document-requests")
  const url = client.fileflowLink

  if (!url) {
    return (
      <div className="space-y-6">
        <PageHeader defaultTitle="Document Requests" page="document-requests" content={pageContent} />
        <div className="flex items-center justify-center h-64 bg-gray-50 rounded-lg border border-gray-200">
          <p className="text-sm text-gray-500">Document portal not configured. Please contact your attorney.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader defaultTitle="Document Requests" page="document-requests" content={pageContent} />
      <div className="flex flex-col items-center justify-center gap-4 py-16 bg-gray-50 rounded-lg border border-gray-200">
        <p className="text-gray-600 text-center max-w-sm">
          Your document portal opens in a new tab where you can upload and manage requested documents.
        </p>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
        >
          Open Document Portal ↗
        </a>
      </div>
    </div>
  )
}
