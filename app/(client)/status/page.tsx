// app/(client)/status/page.tsx
import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { getClientByEmail } from "@/lib/airtable"
import PageHeader from "@/components/ui/PageHeader"
import { getPageContent } from "@/lib/page-content"

export default async function StatusPage() {
  const session = await auth()
  if (!session?.user?.email) redirect("/login")
  const client = await getClientByEmail(session.user.email)
  if (!client) redirect("/login")

  const pageContent = await getPageContent(client.clientId, "status")

  return (
    <div className="space-y-6">
      <PageHeader defaultTitle="Case Status" header={pageContent.header} announcement={pageContent.announcement} />
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        {client.statusOfCase ? (
          <p className="text-gray-800 whitespace-pre-wrap">{client.statusOfCase}</p>
        ) : (
          <p className="text-sm text-gray-500">No status update available. Please contact your attorney.</p>
        )}
      </div>
    </div>
  )
}
