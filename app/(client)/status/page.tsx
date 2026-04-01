// app/(client)/status/page.tsx
import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { getClientByEmail } from "@/lib/airtable"
import AirtableEmbed from "@/components/ui/AirtableEmbed"

export default async function StatusPage() {
  const session = await auth()
  if (!session?.user?.email) redirect("/login")
  const client = await getClientByEmail(session.user.email)
  if (!client) redirect("/login")

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Case Status</h1>
      <AirtableEmbed url={client.statusViewLink} title="Case Status" />
    </div>
  )
}
