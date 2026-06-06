import { auth } from "@/auth"
import { cookies } from "next/headers"
import { sql } from "@/lib/db"
import { getClientByEmail, type AirtableClient } from "@/lib/airtable"

export const PREVIEW_COOKIE = "previewClientEmail"

async function isAdmin(email: string): Promise<boolean> {
  try {
    const r = await sql`SELECT 1 FROM admin_users WHERE email = ${email} LIMIT 1`
    return r.rows.length > 0
  } catch {
    return false
  }
}

// The email whose portal an admin is currently previewing, or null. Only honored
// for verified admins, so a real client can never trigger preview mode.
export async function getActivePreviewEmail(): Promise<string | null> {
  const session = await auth()
  if (!session?.user?.email) return null
  const store = await cookies()
  const previewEmail = store.get(PREVIEW_COOKIE)?.value || null
  if (!previewEmail) return null
  return (await isAdmin(session.user.email)) ? previewEmail : null
}

// Resolves the client whose portal should render. Identical to
// getClientByEmail(session email) for everyone except an admin actively
// previewing another client.
export async function getPortalClient(): Promise<AirtableClient | null> {
  const session = await auth()
  if (!session?.user?.email) return null
  const previewEmail = await getActivePreviewEmail()
  return getClientByEmail(previewEmail ?? session.user.email)
}
