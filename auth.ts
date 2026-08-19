import NextAuth from "next-auth"
import Google from "next-auth/providers/google"
import Resend from "next-auth/providers/resend"
import PostgresAdapter from "@auth/pg-adapter"
import { db } from "@vercel/postgres"
import type { Pool } from "pg"
import authConfig from "@/auth.config"
import { sql } from "@/lib/db"
import { getClientByEmail } from "@/lib/airtable"
import { sendMagicLinkEmail } from "@/lib/resend"

// Email-link sign-in only sends to addresses we already know - an admin or a
// client on the Airtable Clients board. Keeps the firm's email sender from
// being abused and strangers from receiving sign-in links.
async function isKnownPortalEmail(email: string): Promise<boolean> {
  const e = email.trim().toLowerCase()
  try {
    const r = await sql`SELECT 1 FROM admin_users WHERE LOWER(email) = ${e} LIMIT 1`
    if (r.rows.length > 0) return true
  } catch {}
  try {
    return Boolean(await getClientByEmail(e))
  } catch {
    return false // Airtable unreachable - fail closed; the client can retry
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  // Adapter stores users + magic-link verification tokens (tables exist from
  // scripts/migrate.ts). Sessions stay JWT (set in auth.config.ts) - the
  // pre-adapter behavior - so existing Google sign-ins keep working unchanged.
  // db is a VercelPool: pg-Pool-compatible at runtime, hence the type cast.
  adapter: PostgresAdapter(db as unknown as Pool),
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      // A client may first sign in via email link (creating their user row),
      // then later use Google with the same address - allow that link-up.
      // Safe here: Google verifies emails, and all portal authorization is
      // by email match against Airtable/admin_users anyway.
      allowDangerousEmailAccountLinking: true,
    }),
    Resend({
      apiKey: process.env.RESEND_API_KEY,
      from: process.env.EMAIL_FROM ?? "Edwards Family Law <portal@edwardsfamilylaw.com>",
      async sendVerificationRequest({ identifier, url }) {
        await sendMagicLinkEmail({ to: identifier, url })
        await sql`INSERT INTO auth_activity (kind, email, provider) VALUES ('link_sent', ${identifier.toLowerCase()}, 'resend')`.catch(() => {})
      },
    }),
  ],
  events: {
    // Every successful sign-in (Google or email link) lands on the admin
    // dashboard's Recent activity. Fail-soft: logging must never block login.
    async signIn({ user, account }) {
      if (!user?.email) return
      await sql`INSERT INTO auth_activity (kind, email, provider) VALUES ('sign_in', ${user.email.toLowerCase()}, ${account?.provider ?? null})`.catch(() => {})
    },
  },
  callbacks: {
    ...authConfig.callbacks,
    async signIn({ user, account, email }) {
      // Gate the SEND step of magic links to known client/admin emails.
      if (account?.provider === "resend" && email?.verificationRequest) {
        return user?.email ? await isKnownPortalEmail(user.email) : false
      }
      return true
    },
  },
})
