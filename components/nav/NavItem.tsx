// components/nav/NavItem.tsx
"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

interface NavItemProps {
  href: string
  label: string
  icon: string
  unreadCount?: number
}

export default function NavItem({ href, label, icon, unreadCount = 0 }: NavItemProps) {
  const pathname = usePathname()
  const isActive = pathname === href || pathname.startsWith(href + "/")

  return (
    <Link
      href={href}
      title={label}
      aria-label={label}
      className={`relative w-[84px] py-2.5 rounded-xl flex flex-col items-center gap-1.5 transition-colors ${
        isActive ? "bg-[#1B2D45] text-white" : "text-[#33404c] hover:bg-[#efe7da]"
      }`}
    >
      <span className="text-[23px] leading-none">{icon}</span>
      <span className="text-[11px] font-medium leading-tight text-center px-0.5 break-words">{label}</span>
      {unreadCount > 0 && (
        <span className="absolute top-1 right-1.5 inline-flex items-center justify-center min-w-[16px] h-4 px-1 text-[9px] font-bold rounded-full bg-red-500 text-white">
          {unreadCount > 9 ? "9+" : unreadCount}
        </span>
      )}
    </Link>
  )
}
