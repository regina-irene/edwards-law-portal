// app/api/admin/conversations/route.ts - one conversation per client for the
// admin Message Center. Archived (former) clients are left out unless the
// caller asks for them with ?archived=1, so a closed case doesn't sit in the
// inbox next to live ones.
import { requireAdmin } from "@/lib/admin"
import { sql } from "@/lib/db"
import { fetchAllClientsRaw, clientDisplayLabel } from "@/lib/airtable"
import { getClientLabels } from "@/lib/client-labels"
import { archiveNotes, type ArchiveNote } from "@/lib/admin-archive"
import { NextResponse } from "next/server"

export async function GET(req: Request) {
  const check = await requireAdmin()
  if (check.status !== "ok") return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const includeArchived = new URL(req.url).searchParams.get("archived") === "1"

  try {
    const [clients, labels, lastRes, unreadRes] = await Promise.all([
      fetchAllClientsRaw().catch(() => []),
      getClientLabels().catch(() => ({} as Record<string, string>)),
      sql`SELECT DISTINCT ON (client_id) client_id, body, sender, created_at FROM chat_messages ORDER BY client_id, created_at DESC`.catch(() => ({ rows: [] as any[] })),
      sql`SELECT client_id, COUNT(*) AS c FROM chat_messages WHERE sender='client' AND read=false GROUP BY client_id`.catch(() => ({ rows: [] as any[] })),
    ])

    const lastByClient = new Map(lastRes.rows.map((r) => [r.client_id, r]))
    const unreadByClient = new Map(unreadRes.rows.map((r) => [r.client_id, parseInt(r.c, 10) || 0]))

    const visible = includeArchived ? clients : clients.filter((c) => !c.archived)
    // How many were hidden, so the toggle can say so rather than making the
    // firm wonder where a conversation went.
    const archivedCount = clients.filter((c) => c.archived).length
    // Read-only; never creates a stamp. Only needed when archived rows are shown.
    const notes: Map<string, ArchiveNote> = includeArchived
      ? await archiveNotes(visible)
      : new Map<string, ArchiveNote>()

    const conversations = visible.map((c) => {
      const id = String(c.clientId)
      const last = lastByClient.get(id)
      return {
        id,
        name: labels[id] || clientDisplayLabel(c.name) || c.name,
        email: c.email ?? "",
        preview: last ? (last.sender === "firm" ? "You: " : "") + String(last.body ?? "").slice(0, 80) : "",
        lastAt: last?.created_at ?? null,
        unread: unreadByClient.get(id) ?? 0,
        archived: c.archived,
        archiveNote: c.archived ? (notes.get(id)?.note ?? "") : "",
      }
    })

    conversations.sort((a, b) => {
      // Archived conversations sink below every live one, whatever their dates.
      if (a.archived !== b.archived) return a.archived ? 1 : -1
      if (a.lastAt && b.lastAt) return new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime()
      if (a.lastAt) return -1
      if (b.lastAt) return 1
      return a.name.localeCompare(b.name)
    })

    return NextResponse.json({ conversations, archivedCount })
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
