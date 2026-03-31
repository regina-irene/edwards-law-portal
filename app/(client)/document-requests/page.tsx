// app/(client)/document-requests/page.tsx
import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { getClientByEmail } from "@/lib/airtable"

export default async function DocumentRequestsPage() {
  const session = await auth()
  if (!session?.user?.email) redirect("/login")
  const client = await getClientByEmail(session.user.email)
  if (!client) redirect("/login")

  const url = client.fileflowLink

  if (!url) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">Document Requests</h1>
        <div className="flex items-center justify-center h-64 bg-gray-50 rounded-lg border border-gray-200">
          <p className="text-sm text-gray-500">Document portal not configured. Please contact your attorney.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Document Requests</h1>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-blue-600 hover:underline"
        >
          Open in new tab ↗
        </a>
      </div>

      {/* Desktop: embedded iframe */}
      <div className="hidden md:block rounded-lg overflow-hidden border border-gray-200 shadow-sm">
        <iframe
          src={url}
          title="Document Requests"
          width="100%"
          height="700"
          className="block"
          frameBorder="0"
        />
      </div>

      {/* Mobile: full-width button */}
      <div className="md:hidden">
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="block w-full text-center px-6 py-4 bg-blue-600 text-white rounded-xl font-medium text-lg hover:bg-blue-700 transition-colors"
        >
          Open Document Portal ↗
        </a>
        <p className="mt-3 text-sm text-gray-500 text-center">
          Upload and manage your requested documents
        </p>
      </div>
    </div>
  )
}
