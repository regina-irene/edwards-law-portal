"use server"

import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { requireAdmin } from "@/lib/admin"
import { fetchAllClientsRaw } from "@/lib/airtable"
import { PREVIEW_COOKIE } from "@/lib/portal-client"

// Admin-only: start previewing a client's portal by setting a cookie with that
// client's email, then jump into the portal.
export async function startPreview(clientId: string) {
  const check = await requireAdmin()
  if (check.status !== "ok") return

  const clients = await fetchAllClientsRaw()
  const target = clients.find((c) => String(c.clientId) === clientId)
  if (!target?.email) return

  const store = await cookies()
  store.set(PREVIEW_COOKIE, target.email, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  })
  redirect("/dashboard")
}

export async function stopPreview() {
  const store = await cookies()
  store.delete(PREVIEW_COOKIE)
  redirect("/admin")
}
