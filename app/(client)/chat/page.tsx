// app/(client)/chat/page.tsx
import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { getClientByEmail } from "@/lib/airtable"
import { getPageContent } from "@/lib/page-content"
import PageHeader from "@/components/ui/PageHeader"
import FrontChatWidget from "@/components/chat/FrontChatWidget"

export default async function ChatPage() {
  const session = await auth()
  if (!session?.user?.email) redirect("/login")
  const client = await getClientByEmail(session.user.email)
  if (!client) redirect("/login")

  const pageContent = await getPageContent(client.clientId, "chat")

  return (
    <div className="space-y-6">
      <PageHeader defaultTitle="Chat" header={pageContent.header} announcement={pageContent.announcement} />
      <div className="flex items-center justify-center h-64 bg-gray-50 rounded-lg border border-gray-200">
        <p className="text-sm text-gray-500">
          Click the chat bubble in the bottom corner to start a conversation.
        </p>
      </div>
      <FrontChatWidget />
    </div>
  )
}
