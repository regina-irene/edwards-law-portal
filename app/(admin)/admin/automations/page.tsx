// app/(admin)/admin/automations/page.tsx - rules that tell clients when
// something new lands on their case (2026-09-04).
import { redirect } from "next/navigation"
import PageTitle from "@/components/ui/PageTitle"
import Automations from "@/components/admin/Automations"
import { requireAdmin } from "@/lib/admin"
import { taglineFor } from "@/lib/taglines"

export const dynamic = "force-dynamic"

export default async function AutomationsPage() {
  const check = await requireAdmin()
  if (check.status !== "ok") redirect("/login")

  return (
    <div className="space-y-6">
      <div>
        <PageTitle title="Automations" tagline={taglineFor("admin:automations")} />
        <p className="text-sm text-gray-500 mt-1">
          Rules that watch your clients&apos; boards and tell the client when something new arrives.
          Everything here is off until you switch it on.
        </p>
      </div>
      <Automations />
    </div>
  )
}
