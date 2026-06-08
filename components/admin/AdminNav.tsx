"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

const ITEMS = [
  { href: "/admin", label: "Clients", match: (p: string) => p === "/admin" || p.startsWith("/admin/clients") || p.startsWith("/admin/chat") || p.startsWith("/admin/messages") },
  { href: "/admin/tasks", label: "Tasks", match: (p: string) => p.startsWith("/admin/tasks") },
  { href: "/admin/pages", label: "Global Pages", match: (p: string) => p.startsWith("/admin/pages") },
  { href: "/admin/settings", label: "Settings", match: (p: string) => p.startsWith("/admin/settings") },
]

export default function AdminNav() {
  const pathname = usePathname()
  return (
    <nav className="p-3 space-y-1">
      {ITEMS.map((it) => {
        const active = it.match(pathname)
        return (
          <Link
            key={it.href}
            href={it.href}
            className={`block px-3 py-2 rounded-lg text-sm transition-colors ${
              active ? "bg-[#1A2A4A] text-white" : "text-slate-700 hover:bg-stone-200/60"
            }`}
          >
            {it.label}
          </Link>
        )
      })}
    </nav>
  )
}
