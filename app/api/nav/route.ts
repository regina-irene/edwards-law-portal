// app/api/nav/route.ts
import { auth } from "@/auth"
import { sql } from "@/lib/db"

const DEFAULT_PAGES = [
  "dashboard",
  "document-requests",
  "pleadings",
  "discovery",
  "calendar",
  "messages",
  "chat",
]

export async function GET() {
  const session = await auth()
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const result = await sql`SELECT pages FROM nav_order LIMIT 1`
  const pages = result.rows[0]?.pages ?? DEFAULT_PAGES
  return Response.json({ pages })
}

export async function PUT(req: Request) {
  const session = await auth()
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const { pages } = await req.json()
  if (!Array.isArray(pages)) {
    return Response.json({ error: "pages must be an array" }, { status: 400 })
  }

  await sql`DELETE FROM nav_order`
  await sql`INSERT INTO nav_order (pages) VALUES (${JSON.stringify(pages)}::jsonb)`

  return Response.json({ pages })
}
