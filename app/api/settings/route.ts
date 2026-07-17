import { NextResponse } from "next/server"
import { getPortalClient } from "@/lib/portal-client"
import { saveClientPrefs } from "@/lib/client-prefs"

export async function PUT(req: Request) {
  const client = await getPortalClient()
  if (!client) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json().catch(() => null)
  const showJoke = Boolean(body?.showJoke)

  await saveClientPrefs(String(client.clientId), { showJoke })
  return NextResponse.json({ ok: true })
}
