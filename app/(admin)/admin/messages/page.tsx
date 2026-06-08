// app/(admin)/admin/messages/page.tsx — Message Center (inbox)
import { Suspense } from "react"
import MessageCenter from "@/components/messages/MessageCenter"

export default function MessagesPage() {
  return (
    <Suspense fallback={<p className="text-sm text-gray-400">Loading…</p>}>
      <MessageCenter />
    </Suspense>
  )
}
