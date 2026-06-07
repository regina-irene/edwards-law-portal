// Streams a page's banner image (private blob) to the logged-in client/admin.
import { getPortalClient } from "@/lib/portal-client"
import { getPageContent } from "@/lib/page-content"
import { get } from "@vercel/blob"
import { NextResponse } from "next/server"

export async function GET(_req: Request, { params }: { params: Promise<{ page: string }> }) {
  const client = await getPortalClient()
  if (!client?.clientId) return new NextResponse("Forbidden", { status: 403 })
  const { page } = await params

  const content = await getPageContent(String(client.clientId), page)
  if (!content.image_pathname) return new NextResponse("Not found", { status: 404 })

  const result = await get(content.image_pathname, { access: "private" })
  if (!result || result.statusCode !== 200) return new NextResponse("Not found", { status: 404 })

  return new NextResponse(result.stream, {
    headers: {
      "Content-Type": result.blob.contentType || "image/*",
      "Cache-Control": "private, no-cache",
    },
  })
}
