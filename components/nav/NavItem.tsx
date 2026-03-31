// components/nav/NavItem.tsx
"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

const PAGE_LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  "document-requests": "Document Requests",
  pleadings: "Pleadings",
  discovery: "Discovery",
  calendar: "Calendar",
  messages: "Messages",
  chat: "Chat",
}

interface NavItemProps {
  page: string
  unreadCount?: number
}

export default function NavItem({ page, unreadCount = 0 }: NavItemProps) {
  const pathname = usePathname()
  const href = `/${page}`
  const isActive = pathname === href || pathname.startsWith(href + "/")
  const label = PAGE_LABELS[page] ?? page

  return (
    <Link
      href={href}
      className={`flex items-center justify-between px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
        isActive
          ? "bg-blue-600 text-white"
          : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
      }`}
    >
      <span>{label}</span>
      {unreadCount > 0 && (
        <span className="ml-2 inline-flex items-center justify-center w-5 h-5 text-xs font-bold rounded-full bg-red-500 text-white">
          {unreadCount > 9 ? "9+" : unreadCount}
        </span>
      )}
    </Link>
  )
}
