import type { NextAuthConfig } from "next-auth"

// Proxy-safe base config - deliberately imports NO database, email, or
// Airtable code. proxy.ts builds a lightweight NextAuth from this just to
// read JWT session cookies; auth.ts extends it with the pg adapter and the
// real providers (Google OAuth + Resend magic links).
const authConfig = {
  trustHost: true,
  session: { strategy: "jwt" },
  providers: [], // real providers live in auth.ts; the proxy only reads JWTs
  callbacks: {
    session({ session, token }) {
      if (token?.email) session.user.email = token.email as string
      return session
    },
  },
  pages: {
    signIn: "/login",
    verifyRequest: "/login?verify=1",
  },
} satisfies NextAuthConfig

export default authConfig
