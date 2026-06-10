import { auth } from "@/auth"
import { NextResponse } from "next/server"

const PROTECTED_PATHS = [
  "/dashboard",
  "/pleadings",
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
    "/discovery/:path*",
    "/calendar/:path*",
    "/messages/:path*",
    "/chat/:path*",
    "/settings/:path*",
    "/p/:path*",
    "/admin/:path*",
  ],
}
