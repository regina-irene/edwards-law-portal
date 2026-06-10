// app/(client)/calendar/page.tsx
import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { getPortalClient, getActivePreviewEmail } from "@/lib/portal-client"
import PageHeader from "@/components/ui/PageHeader"
import RefreshButton from "@/components/ui/RefreshButton"
import PrintButton from "@/components/ui/PrintButton"
import { getPageContent } from "@/lib/page-content"
import { getCaseEvents } from "@/lib/calendar"
import CalendarClient from "@/components/calendar/CalendarClient"
import { refreshCalendarPage } from "./actions"

function formatRefreshed(ms: number): string {
  return new Date(ms).toLocaleString("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

export default async function CalendarPage() {
  const session = await auth()
  if (!session?.user?.email) redirect("/login")
  const client = await getPortalClient()
  if (!client) redirect("/login")

  const [pageContent, events, previewEmail] = await Promise.all([
    getPageContent(client.clientId, "calendar"),
    getCaseEvents(String(client.clientId)),
    getActivePreviewEmail(),
  ])
  const refreshedAt = formatRefreshed(Date.now())

  return (
    <div className="space-y-6">
      {/* When the calendar renders, suppress any embed configured in the
          page-content editor — the rendered calendar replaces it. */}
      <PageHeader defaultTitle="Calendar" page="calendar" content={events ? { ...pageContent, embed_url: null } : pageContent} />
      {events ? (
        <>
          <div className="flex items-end justify-between gap-3 flex-wrap">
            <div className="space-y-1.5">
              {previewEmail && (
                <form action={refreshCalendarPage} className="print:hidden">
                  <RefreshButton label="Refresh" />
                </form>
              )}
              <p className="text-xs text-gray-500">
                <span className="inline-block w-2 h-2 rounded-full bg-green-500 mr-1.5 align-middle print:hidden" />
                Synced with EFL · Current data as of {refreshedAt}
              </p>
            </div>
            <PrintButton />
          </div>
          <CalendarClient events={events} />
        </>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 p-6"><p className="text-sm text-gray-500">We couldn&apos;t load this information right now. Please check back shortly or contact our office.</p></div>
      )}
    </div>
  )
}
