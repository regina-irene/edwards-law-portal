// lib/admin.ts — checks if the current session user is an admin
import { auth } from "@/auth"
import { sql } from "@/lib/db"

export async function requireAdmin(): Promise<{ email: string } | null> {
  const session = await auth()
  if (!session?.user?.email) return null

  const result = await sql`
    SELECT email FROM admin_users WHERE email = ${session.user.email} LIMIT 1
  `
  if (result.rows.length === 0) return null

  return { email: session.user.email }
}
