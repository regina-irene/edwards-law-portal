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
import CasePills from "@/components/status/CasePills"

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

      {/* Status of Your Case — top, highlighted, with the last-modified label */}
      <div className="bg-white rounded-lg p-6 shadow-md border border-gray-200 border-l-4" style={{ borderLeftColor: "#1b2d45" }}>
        <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
          <h2 className="text-xs uppercase tracking-wide font-semibold" style={{ color: "#1b2d45" }}>Status of Your Case</h2>
          {statusUpdated && (
            <span className="text-xs font-medium px-2.5 py-1 rounded-full" style={{ background: "#efe2d2", color: "#1b2d45" }}>
              Updated {statusUpdated}
            </span>
          )}
        </div>
        {statusText ? (
          <p className="text-gray-800 whitespace-pre-wrap">{statusText}</p>
        ) : (
          <p className="text-sm text-gray-500">No status update available. Please contact your attorney.</p>
        )}
      </div>

      {caseStatus && <CasePills info={caseStatus} />}

      {billing && <BillingSection billing={billing} />}
    </div>
  )
}
