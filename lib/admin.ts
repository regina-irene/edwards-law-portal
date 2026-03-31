// lib/admin.ts
import { auth } from "@/auth"
import { sql } from "@/lib/db"

export type AdminCheckResult =
  | { status: "ok"; email: string }
  | { status: "unauthenticated" }
  | { status: "forbidden" }

export async function requireAdmin(): Promise<AdminCheckResult> {
  const session = await auth()
  if (!session?.user?.email) return { status: "unauthenticated" }

  const result = await sql`
    SELECT email FROM admin_users WHERE email = ${session.user.email} LIMIT 1
  `
  if (result.rows.length === 0) return { status: "forbidden" }

  return { status: "ok", email: session.user.email }
}
