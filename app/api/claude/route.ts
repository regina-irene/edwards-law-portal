// app/api/claude/route.ts
import { auth } from "@/auth"
import { processTasks } from "@/lib/claude"
import { AirtableTask } from "@/lib/airtable"
import { NextResponse } from "next/server"

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { tasks } = await req.json() as { tasks: AirtableTask[] }
  if (!Array.isArray(tasks)) {
    return NextResponse.json({ error: "tasks must be an array" }, { status: 400 })
  }

  const today = new Date().toISOString().split("T")[0]
  const dashboard = await processTasks(tasks, today)
  return NextResponse.json(dashboard)
}
