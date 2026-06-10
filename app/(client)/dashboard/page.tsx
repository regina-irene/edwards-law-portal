// app/(client)/dashboard/page.tsx — video first, then straight to the page's
// content section (no title/announcement/image block above it, per Regina).
import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { getPortalClient } from "@/lib/portal-client"
import { getPageContent } from "@/lib/page-content"
import { getSetting } from "@/lib/app-settings"
import { RichTextView } from "@/components/ui/RichTextEditor"
import AirtableEmbed from "@/components/ui/AirtableEmbed"
import DemoVideo from "@/components/dashboard/DemoVideo"

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
  const embedVideo = demoVideoUrl ? youtubeEmbedUrl(demoVideoUrl) : null

  return (
    <div className="space-y-6">
      {embedVideo && <DemoVideo embedUrl={embedVideo} />}

      {pageContent.body && (
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <RichTextView html={pageContent.body} />
        </div>
      )}

      {pageContent.embed_url && (
        <AirtableEmbed url={pageContent.embed_url} title="Dashboard" height={pageContent.embed_height ?? undefined} />
      )}
    </div>
  )
}
