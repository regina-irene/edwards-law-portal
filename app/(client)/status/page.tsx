// app/(client)/status/page.tsx
import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { getPortalClient } from "@/lib/portal-client"
import PageHeader from "@/components/ui/PageHeader"
import { getPageContent } from "@/lib/page-content"
import { getClientBilling } from "@/lib/billing"
import BillingSection from "@/components/billing/BillingSection"

export default async function StatusPage() {
  const session = await auth()
  if (!session?.user?.email) redirect("/login")
  const client = await getPortalClient()
  if (!client) redirect("/login")

  const [pageContent, billing] = await Promise.all([
    getPageContent(client.clientId, "status"),
    getClientBilling(client.id),
  ])

  return (
    <div className="space-y-6">
      <PageHeader defaultTitle="Case Status" page="status" content={pageContent} />
      {billing && <BillingSection billing={billing} />}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-xs uppercase tracking-wide text-gray-500 mb-3">Status of Your Case</h2>
        {client.statusOfCase ? (
          <p className="text-gray-800 whitespace-pre-wrap">{client.statusOfCase}</p>
        ) : (
          <p className="text-sm text-gray-500">No status update available. Please contact your attorney.</p>
        )}
      </div>
    </div>
  )
}
