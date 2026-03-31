// app/(client)/layout.tsx
import { redirect } from "next/navigation"
import { auth } from "@/auth"
import { getClientByEmail } from "@/lib/airtable"
import { sql } from "@/lib/db"
import Sidebar from "@/components/nav/Sidebar"

const DEFAULT_PAGES = [
  "dashboard",
  "document-requests",
  "pleadings",
  "discovery",
  "calendar",
  "messages",
  "chat",
]

async function getNavPages(): Promise<string[]> {
  const result = await sql`SELECT pages FROM nav_order LIMIT 1`
  return result.rows[0]?.pages ?? DEFAULT_PAGES
}

async function getUnreadCounts(clientId: string) {
  const [msgResult, chatResult] = await Promise.all([
    sql`SELECT COUNT(*) as count FROM messages WHERE client_id = ${clientId} AND read = false`,
    sql`SELECT COUNT(*) as count FROM chat_messages WHERE client_id = ${clientId} AND sender = 'firm' AND read = false`,
  ])
  return {
    messages: parseInt(msgResult.rows[0]?.count ?? "0"),
    chat: parseInt(chatResult.rows[0]?.count ?? "0"),
  }
}

export default async function ClientLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session?.user?.email) redirect("/login")

  const client = await getClientByEmail(session.user.email)
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
