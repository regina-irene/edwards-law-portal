// app/api/claude/route.ts
import { auth } from "@/auth"
import { processTasks } from "@/lib/claude"
import { AirtableTask } from "@/lib/airtable"
import { NextResponse } from "next/server"

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  let tasks: AirtableTask[]
  try {
    const body = await req.json()
    if (!Array.isArray(body?.tasks)) {
      return NextResponse.json({ error: "tasks must be an array" }, { status: 400 })
    }
    tasks = body.tasks
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  try {
    const today = new Date().toISOString().split("T")[0]
    const dashboard = await processTasks(tasks, today)
    return NextResponse.json(dashboard)
  } catch {
    return NextResponse.json({ error: "Failed to process tasks" }, { status: 500 })
  }
}
