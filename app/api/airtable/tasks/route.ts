// app/api/airtable/tasks/route.ts
import { auth } from "@/auth"
import { getClientByEmail, getClientTasks } from "@/lib/airtable"
import { NextResponse } from "next/server"

export async function GET() {
  const session = await auth()
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const client = await getClientByEmail(session.user.email)
  if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 })

  const tasks = await getClientTasks(client.clientBaseId)
  return NextResponse.json({ tasks })
}
