import { NextResponse } from "next/server"
import { getPortalClient } from "@/lib/portal-client"
import { saveClientPrefs } from "@/lib/client-prefs"
import { THEMES } from "@/lib/themes"

export async function PUT(req: Request) {
  const client = await getPortalClient()
  if (!client) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json().catch(() => null)
  const theme = String(body?.theme ?? "classic")
  const showJoke = Boolean(body?.showJoke)
  if (!THEMES.some((t) => t.key === theme)) {
    return NextResponse.json({ error: "Unknown theme" }, { status: 400 })
  }

  await saveClientPrefs(String(client.clientId), { theme, showJoke })
  return NextResponse.json({ ok: true })
}
