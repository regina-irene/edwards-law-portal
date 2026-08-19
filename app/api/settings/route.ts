// app/api/settings/route.ts - the client's own portal preferences
import { NextResponse } from "next/server"
import { assertClientCanWrite } from "@/lib/client-write-guard"
import { saveClientPrefs } from "@/lib/client-prefs"
import { SCHEMES, DEFAULT_SCHEME_KEY } from "@/lib/color-schemes"

export async function PUT(req: Request) {
  // Preferences are a write like any other - a closed client's portal is frozen
  // exactly as they left it.
  const gate = await assertClientCanWrite()
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status })
  const client = gate.client

  const body = await req.json().catch(() => null)
  const showJoke = Boolean(body?.showJoke)
  const scheme = typeof body?.scheme === "string" ? body.scheme : DEFAULT_SCHEME_KEY
  if (!SCHEMES[scheme]) return NextResponse.json({ error: "Unknown color scheme" }, { status: 400 })
  const gradient = Boolean(body?.gradient)

  await saveClientPrefs(String(client.clientId), { showJoke, scheme, gradient })
  return NextResponse.json({ ok: true })
}
