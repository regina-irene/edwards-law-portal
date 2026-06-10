// app/(client)/discovery/page.tsx
import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { getPortalClient, getActivePreviewEmail } from "@/lib/portal-client"
import AirtableEmbed from "@/components/ui/AirtableEmbed"
import PageHeader from "@/components/ui/PageHeader"
import RefreshButton from "@/components/ui/RefreshButton"
import PrintButton from "@/components/ui/PrintButton"
import { getPageContent } from "@/lib/page-content"
import { getDiscovery } from "@/lib/discovery"
import DiscoveryTable from "@/components/discovery/DiscoveryTable"
import { refreshDiscoveryPage } from "./actions"

function formatRefreshed(ms: number): string {
  return new Date(ms).toLocaleString("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

export default async function DiscoveryPage() {
  const session = await auth()
  if (!session?.user?.email) redirect("/login")
  const client = await getPortalClient()
  if (!client) redirect("/login")

  const [pageContent, docs, previewEmail] = await Promise.all([
    getPageContent(client.clientId, "discovery"),
    getDiscovery(client.clientBaseId),
    getActivePreviewEmail(),
  ])
  const refreshedAt = formatRefreshed(Date.now())

  return (
    <div className="space-y-6">
      <PageHeader defaultTitle="Discovery" page="discovery" content={pageContent} />
      {/* Sortable table replaces the embed; if this client's base can't be
          read (docs === null) fall back to the old embed so nothing breaks. */}
      {docs ? (
        <>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <p className="text-xs text-gray-500">
              <span className="inline-block w-2 h-2 rounded-full bg-green-500 mr-1.5 align-middle print:hidden" />
              Synced with EFL · Current data as of {refreshedAt}
            </p>
            <div className="flex items-center gap-2 print:hidden">
              <PrintButton />
              {previewEmail && (
                <form action={refreshDiscoveryPage}>
                  <RefreshButton label="Refresh" />
                </form>
              )}
            </div>
          </div>
          <DiscoveryTable docs={docs} />
        </>
      ) : (
        <AirtableEmbed url={client.discoveryViewLink} title="Discovery" />
      )}
    </div>
  )
}
