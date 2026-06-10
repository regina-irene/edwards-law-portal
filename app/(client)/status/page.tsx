// app/(client)/status/page.tsx
import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { getPortalClient } from "@/lib/portal-client"
import { getCaseStatus } from "@/lib/airtable"
import RefreshButton from "@/components/ui/RefreshButton"
import { refreshStatusPage } from "./actions"

function formatRefreshed(ms: number): string {
  return new Date(ms).toLocaleString("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}
import PageHeader from "@/components/ui/PageHeader"
import { getPageContent } from "@/lib/page-content"
import { getClientBilling } from "@/lib/billing"
import BillingSection from "@/components/billing/BillingSection"

export default async function StatusPage() {
  const session = await auth()
  if (!session?.user?.email) redirect("/login")
  const client = await getPortalClient()
  if (!client) redirect("/login")

  const [pageContent, billing, caseStatus] = await Promise.all([
    getPageContent(client.clientId, "status"),
    getClientBilling(client.id),
    getCaseStatus(String(client.clientId)),
  ])
  const refreshedAt = formatRefreshed(Date.now())
  // The Status board's "Case Status - Dashboard" field is the case status for
  // all cases; the old "Status of Case" field on Clients is just a fallback.
  const statusText = caseStatus?.statusText || client.statusOfCase

  const statusUpdated = caseStatus?.lastModified
    ? new Date(caseStatus.lastModified).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
        timeZone: "America/New_York",
      })
    : null

  return (
    <div
      className="-m-6 min-h-[calc(100%+3rem)] px-6 py-6 space-y-6"
      style={{ background: "linear-gradient(170deg, #eaf7fa 0%, #c8e8f0 35%, #9fd3e3 70%, #76b9d3 100%)" }}
    >
      <div className="flex justify-end">
        <form action={refreshStatusPage}>
          <RefreshButton label="Refresh" />
          <span className="block text-right text-xs text-gray-500 mt-1">Last refreshed {refreshedAt}</span>
        </form>
      </div>

      <PageHeader defaultTitle="Case Status" page="status" content={pageContent} />

      {caseStatus && caseStatus.stages.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          {caseStatus.stages.map((stage) => (
            <span
              key={stage}
              className="px-3.5 py-1.5 rounded-full text-sm font-semibold text-white shadow-sm"
              style={{ background: "#1b2d45" }}
            >
              {stage}
            </span>
          ))}
          {statusUpdated && <span className="text-xs text-gray-600">Updated {statusUpdated}</span>}
        </div>
      )}

      {billing && <BillingSection billing={billing} />}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-xs uppercase tracking-wide text-gray-500 mb-3">Status of Your Case</h2>
        {statusText ? (
          <p className="text-gray-800 whitespace-pre-wrap">{statusText}</p>
        ) : (
          <p className="text-sm text-gray-500">No status update available. Please contact your attorney.</p>
        )}
      </div>
    </div>
  )
}
