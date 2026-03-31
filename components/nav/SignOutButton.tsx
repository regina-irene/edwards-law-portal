// components/nav/SignOutButton.tsx
"use client"

import { signOut } from "next-auth/react"

export default function SignOutButton() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: "/login" })}
      className="text-xs text-gray-400 hover:text-gray-600"
    >
      Sign out
    </button>
  )
}
