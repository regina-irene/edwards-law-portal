"use server"

import { cookies, headers } from "next/headers"
import { redirect } from "next/navigation"
import { requireAdmin } from "@/lib/admin"
import { fetchAllClientsRaw } from "@/lib/airtable"
import { PREVIEW_COOKIE } from "@/lib/portal-client"

const RETURN_COOKIE = "previewReturnTo"

// Admin-only: start previewing a client's portal by setting a cookie with that
// client's email, then jump into the portal. Remembers the admin page the
// preview was started from so Exit preview returns there.
export async function startPreview(clientId: string) {
  const check = await requireAdmin()
  if (check.status !== "ok") return

  const clients = await fetchAllClientsRaw()
  const target = clients.find((c) => String(c.clientId) === clientId)
  if (!target?.email) return

  // where did she click Preview? (referer → pathname, admin pages only)
  let returnTo = "/admin"
  try {
    const referer = (await headers()).get("referer")
    if (referer) {
      const path = new URL(referer).pathname
      if (path.startsWith("/admin")) returnTo = path
    }
  } catch {}

  const store = await cookies()
  store.set(PREVIEW_COOKIE, target.email, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  })
  store.set(RETURN_COOKIE, returnTo, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  })
  redirect("/dashboard")
}

export async function stopPreview() {
  const store = await cookies()
  const returnTo = store.get(RETURN_COOKIE)?.value
  store.delete(PREVIEW_COOKIE)
  store.delete(RETURN_COOKIE)
  // only ever return to an admin path; anything else falls back to /admin
  redirect(returnTo?.startsWith("/admin") ? returnTo : "/admin")
}
