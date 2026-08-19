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
import { getPleadings } from "@/lib/pleadings"
import { getCaseEvents, nextCourtDate } from "@/lib/calendar"
import BillingSection from "@/components/billing/BillingSection"
import CaseDetailsCard from "@/components/status/CaseDetailsCard"
import { paymentStatusColor } from "@/lib/airtable-colors"

export default async function StatusPage() {
  const session = await auth()
  if (!session?.user?.email) redirect("/login")
  const client = await getPortalClient()
  if (!client) redirect("/login")

  const [pageContent, billing, caseStatus, pleadings, events] = await Promise.all([
    getPageContent(client.clientId, "status"),
    getClientBilling(client.id),
    getCaseStatus(String(client.clientId)),
    getPleadings(client.clientBaseId),
    getCaseEvents(String(client.clientId)),
  ])
  // pleadings come back newest-first; surface the last 3 filings in Case Details
  const recentFilings = (pleadings ?? []).slice(0, 3).map((p) => ({
    title: p.title,
    date: p.filedOn, // date on the document only — never the Drive-sync date
    filedBy: p.filedBy,
    link: p.link,
  }))
  const nextCourt = events ? nextCourtDate(events) : null
  const refreshedAt = formatRefreshed(Date.now())
  // The Status board's "Case Status - Dashboard" field is the case status for
  // all cases; the old "Status of Case" field on Clients is just a fallback.
  const statusText = caseStatus?.statusText || client.statusOfCase
  const statusUpdated = caseStatus?.lastModified
    ? new Date(caseStatus.lastModified).toLocaleString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        timeZone: "America/New_York",
      })
    : null

  return (
    <div className="space-y-6">
      {/* Embed removed per Regina (2026-06-09) — the pulled-out info below replaces the Airtable embed view */}
      <PageHeader defaultTitle="Case Status" page="status" content={{ ...pageContent, embed_url: null }} />

      {/* Everyone sees this, not just admins previewing (2026-08-18). Case data
          is read through a 60-second cache, so "you're always current" was no
          longer true, and a client checking after a call had no way to pull
          again. Refresh drops the cache and re-reads. */}
      <div className="flex items-center justify-between gap-3 flex-wrap print:hidden">
        <span className="text-xs text-gray-500">Last checked {refreshedAt}</span>
        <form action={refreshStatusPage}>
          <RefreshButton label="Check for updates" />
        </form>
      </div>

      {/* Status of Your Case (highlighted, with last-modified label), Case Details below */}
      <div className="bg-white rounded-lg p-6 shadow-md border border-gray-200 border-l-4" style={{ borderLeftColor: "#1b2d45" }}>
          <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
            <h2 className="text-xs uppercase tracking-wide font-semibold" style={{ color: "#1b2d45" }}>Status of Your Case</h2>
            {statusUpdated && (
              <span className="text-xs font-medium px-2.5 py-1 rounded-full" style={{ background: "#efe2d2", color: "#1b2d45" }}>
                Updated by EFL · {statusUpdated}
              </span>
            )}
          </div>
          {statusText ? (
            <p className="text-gray-800 whitespace-pre-wrap">{statusText}</p>
          ) : (
            <p className="text-sm text-gray-500">No status update available. Please contact your attorney.</p>
          )}
      </div>

      {caseStatus && (
        <CaseDetailsCard
          info={caseStatus}
          recentFilings={recentFilings}
          nextCourt={nextCourt ? { title: nextCourt.title, start: nextCourt.start, allDay: nextCourt.allDay } : null}
        />
      )}

      {caseStatus?.paymentStatus && (
        <div className="flex items-center gap-2">
          <span className="text-xs uppercase tracking-wide font-semibold" style={{ color: "#1b2d45" }}>Payment Status</span>
          <span
            className="px-3.5 py-1.5 rounded-full text-sm font-semibold shadow-sm border border-black/5"
            style={{ background: paymentStatusColor(caseStatus.paymentStatus).bg, color: paymentStatusColor(caseStatus.paymentStatus).text }}
          >
            {caseStatus.paymentStatus}
          </span>
        </div>
      )}

      {billing && <BillingSection billing={billing} />}
    </div>
  )
}
