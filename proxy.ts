import NextAuth from "next-auth"
import authConfig from "@/auth.config"
import { NextResponse } from "next/server"

// Lightweight auth for the proxy: reads the JWT session cookie only — no
// adapter, no providers, none of auth.ts's heavier imports in this bundle.
const { auth } = NextAuth(authConfig)

const PROTECTED_PATHS = [
  "/dashboard",
  "/pleadings",
  "/correspondence",
  "/discovery",
  "/calendar",
  "/messages",
  "/chat",
  "/settings",
  "/p",
  "/admin",
]

export default auth((req) => {
  const { pathname } = req.nextUrl
  const isProtected = PROTECTED_PATHS.some((p) => pathname.startsWith(p))

  if (isProtected && !req.auth) {
    const loginUrl = new URL("/login", req.url)
    loginUrl.searchParams.set("callbackUrl", pathname)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
})

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/pleadings/:path*",
    "/correspondence/:path*",
    "/discovery/:path*",
    "/calendar/:path*",
    "/messages/:path*",
    "/chat/:path*",
    "/settings/:path*",
    "/p/:path*",
    "/admin/:path*",
  ],
}
