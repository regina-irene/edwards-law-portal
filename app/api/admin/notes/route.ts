// app/api/admin/notes/route.ts - Field Notes CRUD. ADMIN ONLY: notes are the
// firm's private case log; no client-facing route may ever serve them.
import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin"
import { listNotes, createNote, updateNote, deleteNote } from "@/lib/notes"

// Returns a NextResponse when access is denied, otherwise the signed-in admin
// (whose name is stamped on any note they write).
async function gate(): Promise<NextResponse | { email: string; name: string }> {
  const check = await requireAdmin()
  if (check.status === "unauthenticated") return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (check.status === "forbidden") return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  return { email: check.email, name: check.name }
}

export async function GET(req: Request) {
  const admin = await gate()
  if (admin instanceof NextResponse) return admin
  const clientId = new URL(req.url).searchParams.get("clientId")
  if (!clientId) return NextResponse.json({ error: "clientId required" }, { status: 400 })
  try {
    return NextResponse.json({ notes: await listNotes(clientId) })
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(req: Request) {
  const admin = await gate()
  if (admin instanceof NextResponse) return admin
  const parsed = await req.json().catch(() => null)
  const clientId = typeof parsed?.clientId === "string" ? parsed.clientId : ""
  const body = typeof parsed?.body === "string" ? parsed.body : ""
  if (!clientId || !body.trim()) return NextResponse.json({ error: "clientId and body required" }, { status: 400 })
  try {
    return NextResponse.json({ note: await createNote(clientId, body, admin) }, { status: 201 })
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function PATCH(req: Request) {
  const admin = await gate()
  if (admin instanceof NextResponse) return admin
  const parsed = await req.json().catch(() => null)
  const id = typeof parsed?.id === "string" ? parsed.id : ""
  const body = typeof parsed?.body === "string" ? parsed.body : ""
  if (!id || !body.trim()) return NextResponse.json({ error: "id and body required" }, { status: 400 })
  try {
    const note = await updateNote(id, body)
    if (!note) return NextResponse.json({ error: "Not found" }, { status: 404 })
    return NextResponse.json({ note })
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  const admin = await gate()
  if (admin instanceof NextResponse) return admin
  const id = new URL(req.url).searchParams.get("id")
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 })
  try {
    const ok = await deleteNote(id)
    if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
