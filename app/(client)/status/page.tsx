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
import StatusHistory from "@/components/status/StatusHistory"
import { getStatusHistory } from "@/lib/status-history"
import { resolveStatusHtml } from "@/lib/status-rich"
import { RichTextView } from "@/components/ui/RichTextView"
import { resolveVisibleFields, ALREADY_ON_PAGE } from "@/lib/status-fields"
import { getExtraFields } from "@/lib/status-extra"

export default async function StatusPage() {
  const session = await auth()
  if (!session?.user?.email) redirect("/login")
  const client = await getPortalClient()
  if (!client) redirect("/login")

  // "Client ID" is a record link, so String() of it is comma-joined when a
  // client has more than one. Everything on the write side keys off the FIRST
  // id (see statusRecordId / getCaseStatus), so this must strip it the same
  // way - otherwise formatting and history look up a key nobody ever wrote.
  const statusKey = String(client.clientId).split(",")[0].trim()

  const [pageContent, billing, caseStatus, pleadings, events, history, visibleFields] = await Promise.all([
    getPageContent(client.clientId, "status"),
    getClientBilling(client.id),
    getCaseStatus(String(client.clientId)),
    getPleadings(client.clientBaseId),
    getCaseEvents(String(client.clientId)),
    getStatusHistory(statusKey),
    // Which Status-board fields this client may see. Falls back to exactly the
    // set the page has always shown if the settings can't be read, so a
    // database problem can only ever show LESS, never more. See
    // lib/status-fields.ts - anything not switched on is hidden.
    resolveVisibleFields(statusKey),
  ])

  // The additional switched-on fields, minus everything the page already draws
  // so nothing appears twice. Alphabetical: the board has no order to inherit.
  const extraFieldNames = [...visibleFields]
    .filter((name) => !ALREADY_ON_PAGE.has(name))
    .sort((a, b) => a.localeCompare(b))
  const extraFields = caseStatus ? await getExtraFields(statusKey, extraFieldNames) : []
  // pleadings come back newest-first; surface the last 3 filings in Case Details
  const recentFilings = (pleadings ?? []).slice(0, 3).map((p) => ({
    title: p.title,
    date: p.filedOn, // date on the document only - never the Drive-sync date
    filedBy: p.filedBy,
    link: p.link,
  }))
  const nextCourt = events ? nextCourtDate(events) : null
  const refreshedAt = formatRefreshed(Date.now())
  // "Case Status - For Client" on the Status board is the ONLY status text a
  // client may read (2026-08-20). getCaseStatus reads that column and nothing
  // else, so the firm's internal "Case Status - Dashboard" note cannot arrive
  // here. The old "Status of Case" field on Clients remains a legacy fallback;
  // it is client-facing too, so falling back to it is safe. Never fall back to
  // the dashboard column.
  const statusText = caseStatus?.statusText || client.statusOfCase
  const statusHtml = await resolveStatusHtml(statusKey, statusText)
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
      {/* Embed removed per Regina (2026-06-09) - the pulled-out info below replaces the Airtable embed view */}
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
          {statusHtml ? (
            /* Formatting (bold, colour, highlight) is stored portal-side and
               only used while it still matches the words Airtable holds - see
               lib/status-rich. Edited on the board? You get the board's text. */
            <RichTextView html={statusHtml} className="text-gray-800" />
          ) : (
            <p className="text-sm text-gray-500">No status update available. Please contact your attorney.</p>
          )}
      </div>

      {/* Every earlier update, kept so the client can look back at what they
          were told and when. Not the firm's field notes - those stay private. */}
      <StatusHistory entries={history} />

      {caseStatus && (
        <CaseDetailsCard
          info={caseStatus}
          recentFilings={recentFilings}
          nextCourt={nextCourt ? { title: nextCourt.title, start: nextCourt.start, allDay: nextCourt.allDay } : null}
          visibleFields={[...visibleFields]}
          extraFields={extraFields}
        />
      )}

      {/* Payment status now rides in the Case File banner beside Stage rather
          than sitting on its own line under the whole card. */}

      {billing && <BillingSection billing={billing} />}
    </div>
  )
}
