// app/(client)/layout.tsx
import { redirect } from "next/navigation"
import { auth } from "@/auth"
import { getClientByEmail } from "@/lib/airtable"
import { sql } from "@/lib/db"
import Sidebar from "@/components/nav/Sidebar"
import { PORTAL_PAGES } from "@/lib/pages"

async function getNavPages(): Promise<string[]> {
  try {
    const result = await sql`SELECT pages FROM nav_order LIMIT 1`
    const saved: string[] = result.rows[0]?.pages ?? [...PORTAL_PAGES]
    // Append any pages from PORTAL_PAGES not yet in the saved order
    const missing = PORTAL_PAGES.filter((p) => !saved.includes(p))
    return [...saved, ...missing]
  } catch {
    return [...PORTAL_PAGES]
  }
}

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
    client = await getClientByEmail(session.user.email)
  } catch (e) {
    console.error("[layout] getClientByEmail failed:", e)
  }
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
    getNavPages(),
    getUnreadCounts(client.clientId),
  ])

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar
        pages={pages}
        clientName={client.name}
        unreadMessages={unread.messages}
        unreadChat={unread.chat}
      />
      <main className="flex-1 p-8 overflow-auto">{children}</main>
    </div>
  )
}
