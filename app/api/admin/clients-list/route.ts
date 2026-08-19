// app/api/admin/clients-list/route.ts - id + display label for every client,
// for pickers (e.g. the task assign dropdown).
//
// This one deliberately returns EVERY client, archived ones included, each
// carrying an `archived` flag. The Tasks page uses this same list to put a name
// on tasks that were assigned before a case closed; dropping archived clients
// here would leave those rows labelled with a raw Airtable record id. The
// picker itself hides them - see AssignTab's "Include archived".
import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin"
import { getAllClients, clientDisplayLabel } from "@/lib/airtable"
import { getClientLabels } from "@/lib/client-labels"
import { archiveNotes, noteFor } from "@/lib/admin-archive"

export async function GET() {
  const check = await requireAdmin()
  if (check.status !== "ok") return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const [clients, labels] = await Promise.all([getAllClients(), getClientLabels()])
    // Read-only; never creates a stamp.
    const notes = await archiveNotes(clients)
    const list = clients
      .filter((c) => c.clientId)
      .map((c) => {
        const id = String(c.clientId)
        return {
          id,
          label: labels[id] || clientDisplayLabel(c.name) || c.name,
          archived: c.archived,
          archiveNote: c.archived ? noteFor(notes, id).note : "",
        }
      })
      .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: "base" }))
    return NextResponse.json({ clients: list })
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
