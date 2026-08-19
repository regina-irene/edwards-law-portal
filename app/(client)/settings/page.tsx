// app/(client)/settings/page.tsx — client-side settings: portal background
// theme + joke of the day.
import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { getPortalClient } from "@/lib/portal-client"
import PageHeader from "@/components/ui/PageHeader"
import { getPageContent } from "@/lib/page-content"
import { getClientPrefs } from "@/lib/client-prefs"
import SettingsClient from "@/components/settings/SettingsClient"
import { getPortalArchiveState } from "@/lib/client-write-guard"

export default async function SettingsPage() {
  const session = await auth()
  if (!session?.user?.email) redirect("/login")
  const client = await getPortalClient()
  if (!client) redirect("/login")

  const [pageContent, prefs, archive] = await Promise.all([
    getPageContent(client.clientId, "settings"),
    getClientPrefs(String(client.clientId)),
    getPortalArchiveState(client),
  ])

  return (
    <div className="space-y-6">
      <PageHeader defaultTitle="Settings" page="settings" content={pageContent} />
      <SettingsClient
        initialShowJoke={prefs.showJoke}
        initialScheme={prefs.scheme}
        initialGradient={prefs.gradient}
        readOnly={archive.readOnly}
      />
    </div>
  )
}
