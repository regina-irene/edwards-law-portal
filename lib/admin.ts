// lib/admin.ts
import { auth } from "@/auth"
import { sql } from "@/lib/db"

export type AdminCheckResult =
  | { status: "ok"; email: string; name: string }
  | { status: "unauthenticated" }
  | { status: "forbidden" }

// A readable name for whoever is signed in: their admin_users name when it's
// set, otherwise the email's first part ("regina@…" → "Regina") so bylines
// never show a raw address.
export function displayNameFromEmail(email: string): string {
  const local = email.split("@")[0]?.split("+")[0] ?? email
  const words = local.split(/[._-]+/).filter(Boolean)
  if (words.length === 0) return email
  return words.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")
}

export async function requireAdmin(): Promise<AdminCheckResult> {
  const session = await auth()
  if (!session?.user?.email) return { status: "unauthenticated" }

  // Case-INSENSITIVE, and that matters (2026-08-22). auth.ts already compares
  // with LOWER() when deciding whether to send a sign-in link, but this check
  // compared exactly. So a staff row stored as "Kim@edwardsfamilylaw.com" let
  // the person receive a link, sign in successfully, and then be told they had
  // no access - which reads as "the portal is broken", not "the address is
  // capitalised differently". All three checks now agree.
  const result = await sql`
    SELECT email, name FROM admin_users
    WHERE LOWER(email) = ${session.user.email.trim().toLowerCase()}
    LIMIT 1
  `
  if (result.rows.length === 0) return { status: "forbidden" }

  const stored = result.rows[0]?.name
  const name = typeof stored === "string" && stored.trim() ? stored.trim() : displayNameFromEmail(session.user.email)
  return { status: "ok", email: session.user.email, name }
}
