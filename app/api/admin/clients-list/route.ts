// app/api/admin/clients-list/route.ts — id + display label for every client,
// for pickers (e.g. the task assign dropdown).
import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin"
import { getAllClients, clientDisplayLabel } from "@/lib/airtable"
import { getClientLabels } from "@/lib/client-labels"

export async function GET() {
  const check = await requireAdmin()
  if (check.status !== "ok") return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const [clients, labels] = await Promise.all([getAllClients(), getClientLabels()])
    const list = clients
      .filter((c) => c.clientId)
      .map((c) => {
        const id = String(c.clientId)
        return { id, label: labels[id] || clientDisplayLabel(c.name) || c.name }
      })
      .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: "base" }))
    return NextResponse.json({ clients: list })
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
