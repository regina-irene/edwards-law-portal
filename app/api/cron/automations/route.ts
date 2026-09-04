// app/api/cron/automations/route.ts - the hourly check for new documents.
// Vercel calls this on the schedule in vercel.json; the CRON_SECRET check is
// what stops anyone else from calling it.
import { NextResponse } from "next/server"
import { runAutomations } from "@/lib/automation-run"

// A scan reads two Airtable boards for every active client, so give it room.
export const maxDuration = 60
export const dynamic = "force-dynamic"

export async function GET(req: Request) {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 })
  }
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const results = await runAutomations()
    return NextResponse.json({ ok: true, results })
  } catch (e) {
    console.error("[cron/automations] failed:", e)
    return NextResponse.json({ error: "Run failed" }, { status: 500 })
  }
}
