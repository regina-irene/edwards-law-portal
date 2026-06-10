// app/(client)/dashboard/page.tsx
import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { getPortalClient } from "@/lib/portal-client"
import PageHeader from "@/components/ui/PageHeader"
import { getPageContent } from "@/lib/page-content"
import { getSetting } from "@/lib/app-settings"

// "https://www.youtube.com/watch?v=abc" / "https://youtu.be/abc" → embeddable player URL
function youtubeEmbedUrl(url: string): string | null {
  try {
    const u = new URL(url)
    if (u.hostname.includes("youtu.be")) return `https://www.youtube.com/embed/${u.pathname.slice(1)}`
    if (u.pathname.startsWith("/embed/")) return url
    const v = u.searchParams.get("v")
    if (v) return `https://www.youtube.com/embed/${v}`
  } catch {}
  return null
}

export default async function DashboardPage() {
  const session = await auth()
  if (!session?.user?.email) redirect("/login")

  const client = await getPortalClient()
  if (!client) redirect("/login")

  const [pageContent, demoVideoUrl] = await Promise.all([
    getPageContent(client.clientId, "dashboard"),
    getSetting("demo_video_url"),
  ])

  return (
    <div className="space-y-6">
      {/* Demo video first — the welcome mat of the portal */}
      {demoVideoUrl && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-base font-semibold text-gray-900">▶ New here? Watch a quick demo of your portal</p>
          {youtubeEmbedUrl(demoVideoUrl) ? (
            <div className="mt-3 rounded-lg overflow-hidden aspect-video max-w-2xl">
              <iframe
                src={youtubeEmbedUrl(demoVideoUrl)!}
                title="Portal demo video"
                className="w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />
            </div>
          ) : (
            <a href={demoVideoUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 underline mt-2 inline-block">Watch the demo video</a>
          )}
        </div>
      )}

      <PageHeader defaultTitle="Dashboard" page="dashboard" content={pageContent} />
    </div>
  )
}
