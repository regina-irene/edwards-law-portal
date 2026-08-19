// app/(admin)/admin/messages/page.tsx - Message Center (inbox)
import { Suspense } from "react"
import MessageCenter from "@/components/messages/MessageCenter"
import PageTitle from "@/components/ui/PageTitle"
import { taglineFor } from "@/lib/taglines"

export default function MessagesPage() {
  return (
    <div className="space-y-6">
      <PageTitle title="Message Center" tagline={taglineFor("admin:messages")} />
      <Suspense fallback={<p className="text-sm text-gray-400">Loading…</p>}>
        <MessageCenter />
      </Suspense>
    </div>
  )
}
