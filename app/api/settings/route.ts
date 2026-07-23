import { NextResponse } from "next/server"
import { getPortalClient } from "@/lib/portal-client"
import { saveClientPrefs } from "@/lib/client-prefs"
import { SCHEMES, DEFAULT_SCHEME_KEY } from "@/lib/color-schemes"

export async function PUT(req: Request) {
  const client = await getPortalClient()
  if (!client) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json().catch(() => null)
  const showJoke = Boolean(body?.showJoke)
  const scheme = typeof body?.scheme === "string" ? body.scheme : DEFAULT_SCHEME_KEY
  if (!SCHEMES[scheme]) return NextResponse.json({ error: "Unknown color scheme" }, { status: 400 })

  await saveClientPrefs(String(client.clientId), { showJoke, scheme })
  return NextResponse.json({ ok: true })
}
