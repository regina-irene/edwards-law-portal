// app/(client)/settings/page.tsx — client-side settings: portal background
// theme + joke of the day.
import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { getPortalClient } from "@/lib/portal-client"
import PageHeader from "@/components/ui/PageHeader"
import { getPageContent } from "@/lib/page-content"
import { getClientPrefs } from "@/lib/client-prefs"
import SettingsClient from "@/components/settings/SettingsClient"

export default async function SettingsPage() {
  const session = await auth()
  if (!session?.user?.email) redirect("/login")
  const client = await getPortalClient()
  if (!client) redirect("/login")

  const [pageContent, prefs] = await Promise.all([
    getPageContent(client.clientId, "settings"),
    getClientPrefs(String(client.clientId)),
  ])

  return (
    <div className="space-y-6">
      <PageHeader defaultTitle="Settings" page="settings" content={pageContent} />
      <SettingsClient initialTheme={prefs.theme} initialShowJoke={prefs.showJoke} initialLightText={prefs.lightText} />
    </div>
  )
}
