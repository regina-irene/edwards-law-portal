import { cache } from "react"
import { auth } from "@/auth"
import { cookies } from "next/headers"
import { sql } from "@/lib/db"
import { getClientByEmail, type AirtableClient } from "@/lib/airtable"

export const PREVIEW_COOKIE = "previewClientEmail"

// Everything here is wrapped in React's per-request `cache` (2026-08-18).
// Rendering one client page used to run auth() three times, the admin_users
// lookup twice and getPortalClient's Airtable call once per caller, because the
// layout, the page and getPortalClient each did their own. Now the first call
// in a request does the work and the rest are free. Purely a dedupe: same
// inputs, same outputs, and nothing is cached across requests.
export const getSession = cache(async () => auth())

const isAdmin = cache(async (email: string): Promise<boolean> => {
  try {
    const r = await sql`SELECT 1 FROM admin_users WHERE email = ${email} LIMIT 1`
    return r.rows.length > 0
  } catch {
    return false
  }
})

// The email whose portal an admin is currently previewing, or null. Only honored
// for verified admins, so a real client can never trigger preview mode.
export const getActivePreviewEmail = cache(async (): Promise<string | null> => {
  const session = await getSession()
  if (!session?.user?.email) return null
  const store = await cookies()
  const previewEmail = store.get(PREVIEW_COOKIE)?.value || null
  if (!previewEmail) return null
  return (await isAdmin(session.user.email)) ? previewEmail : null
})

// Resolves the client whose portal should render. Identical to
// getClientByEmail(session email) for everyone except an admin actively
// previewing another client.
export const getPortalClient = cache(async (): Promise<AirtableClient | null> => {
  const session = await getSession()
  if (!session?.user?.email) return null
  const previewEmail = await getActivePreviewEmail()
  return getClientByEmail(previewEmail ?? session.user.email)
})
