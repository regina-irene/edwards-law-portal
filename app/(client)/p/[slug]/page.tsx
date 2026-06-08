import { redirect, notFound } from "next/navigation"
import { auth } from "@/auth"
import { getPortalClient } from "@/lib/portal-client"
import { getPageContent } from "@/lib/page-content"
import { getCustomPages, getClientNav } from "@/lib/portal-pages"
import PageHeader from "@/components/ui/PageHeader"

export default async function CustomPortalPage({ params }: { params: Promise<{ slug: string }> }) {
  const session = await auth()
  if (!session?.user?.email) redirect("/login")
  const client = await getPortalClient()
  if (!client) redirect("/login")
  const { slug } = await params

  const custom = await getCustomPages()
  const page = custom.find((p) => p.slug === slug)
  if (!page) notFound()

  // Respect per-client visibility (hidden pages are not accessible)
  const nav = await getClientNav(String(client.clientId))
  if (!nav.some((p) => p.key === slug)) notFound()

  const content = await getPageContent(String(client.clientId), slug)

  return (
    <div className="space-y-6">
      <PageHeader defaultTitle={page.title} page={slug} content={content} />
    </div>
  )
}
