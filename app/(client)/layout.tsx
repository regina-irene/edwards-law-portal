// app/(client)/layout.tsx
import { redirect } from "next/navigation"
import { auth } from "@/auth"
import { getPortalClient, getActivePreviewEmail } from "@/lib/portal-client"
import { stopPreview } from "@/app/preview-actions"
import { sql } from "@/lib/db"
import Sidebar from "@/components/nav/Sidebar"
import { getClientNav } from "@/lib/portal-pages"

async function getUnreadCounts(clientId: string) {
  try {
    const [msgResult, chatResult] = await Promise.all([
      sql`SELECT COUNT(*) as count FROM messages WHERE client_id = ${clientId} AND read = false`,
      sql`SELECT COUNT(*) as count FROM chat_messages WHERE client_id = ${clientId} AND sender = 'firm' AND read = false`,
    ])
    return {
      messages: parseInt(msgResult.rows[0]?.count ?? "0"),
      chat: parseInt(chatResult.rows[0]?.count ?? "0"),
    }
  } catch {
    return { messages: 0, chat: 0 }
  }
}

export default async function ClientLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session?.user?.email) redirect("/login")

  let client
  try {
    client = await getPortalClient()
  } catch (e) {
    console.error("[layout] getPortalClient failed:", e)
  }
  const previewEmail = await getActivePreviewEmail()
  if (!client) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-xl font-semibold text-gray-900">Access Not Found</h1>
          <p className="mt-2 text-gray-600">
            Your email is not linked to a client account. Please contact your attorney.
          </p>
        </div>
      </div>
    )
  }

  if (!client.clientId) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-xl font-semibold text-gray-900">Account Setup Incomplete</h1>
          <p className="mt-2 text-gray-600">
            Your account is missing a client ID. Please contact your attorney.
          </p>
        </div>
      </div>
    )
  }

  const [pages, unread] = await Promise.all([
    getClientNav(String(client.clientId)),
    getUnreadCounts(client.clientId),
  ])

  const today = new Date().toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })

  return (
    <div className="flex min-h-screen" style={{ background: "#FFFFFF" }}>
      <Sidebar pages={pages} unreadMessages={unread.messages} unreadChat={unread.chat} />
      <div className="flex-1 flex flex-col min-h-0">
        {previewEmail && (
          <div className="bg-amber-100 border-b border-amber-300 text-amber-900 text-sm px-4 py-2 flex items-center justify-center gap-3">
            <span>Admin preview — viewing the portal as <strong>{client.name}</strong></span>
            <form action={stopPreview}>
              <button type="submit" className="underline font-medium hover:text-amber-950">Exit preview</button>
            </form>
          </div>
        )}
        {/* Meta strip */}
        <div className="flex items-center justify-between px-6 py-2 border-b" style={{ borderColor: "#E2E8F0" }}>
          <span className="section-label">{today}</span>
          <span className="text-[12px]" style={{ color: "#334155" }}>{client.name}</span>
        </div>
        <main className="flex-1 px-6 py-6 overflow-auto">{children}</main>
      </div>
    </div>
  )
}
