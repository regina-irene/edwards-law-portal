// Lists the forms a task can be linked to: forms built in the portal's own
// builder first, then any FileFlow form that hasn't been imported yet. A
// portal form with the same key wins - that's the copy Regina now edits.
import { requireAdmin } from "@/lib/admin"
import { listForms } from "@/lib/fileflow"
import { listPortalForms } from "@/lib/portal-forms"
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

export async function GET() {
  const check = await requireAdmin()
  if (check.status !== "ok") return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const portal = await listPortalForms().catch((e) => {
    console.error("[fileflow-forms] portal forms failed:", e)
    return []
  })
  const fileflow = await listForms().catch((e) => {
    console.error("[fileflow-forms] fileflow list failed:", e)
    return []
  })

  const keys = new Set(portal.map((f) => f.key))
  const forms = [
    ...portal.map((f) => ({ key: f.key, label: f.label, description: f.description })),
    ...fileflow.filter((f) => !keys.has(f.key)).map((f) => ({ key: f.key, label: `${f.label} (FileFlow)`, description: f.description })),
  ]
  return NextResponse.json({ forms })
}
