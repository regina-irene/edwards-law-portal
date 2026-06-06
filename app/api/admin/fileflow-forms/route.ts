// Lists FileFlow intake forms for the admin task "form" picker.
import { requireAdmin } from "@/lib/admin"
import { listForms } from "@/lib/fileflow"
import { NextResponse } from "next/server"

export async function GET() {
  const check = await requireAdmin()
  if (check.status !== "ok") return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  try {
    const forms = await listForms()
    return NextResponse.json({ forms })
  } catch (e) {
    console.error("[fileflow-forms] list failed:", e)
    return NextResponse.json({ error: "Could not load forms", forms: [] }, { status: 500 })
  }
}
