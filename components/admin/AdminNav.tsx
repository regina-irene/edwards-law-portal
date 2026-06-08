"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import SignOutButton from "@/components/admin/SignOutButton"

const ITEMS = [
  { href: "/admin", label: "Home", icon: "🏠", match: (p: string) => p === "/admin" },
  { href: "/admin/clients", label: "Clients", icon: "👥", match: (p: string) => p.startsWith("/admin/clients") },
  { href: "/admin/messages", label: "Messages", icon: "✉️", match: (p: string) => p.startsWith("/admin/messages") || p.startsWith("/admin/chat") },
  { href: "/admin/tasks", label: "Tasks", icon: "✅", match: (p: string) => p.startsWith("/admin/tasks") },
  { href: "/admin/pages", label: "Pages", icon: "📄", match: (p: string) => p.startsWith("/admin/pages") },
  { href: "/admin/settings", label: "Settings", icon: "⚙️", match: (p: string) => p.startsWith("/admin/settings") },
]

export default function AdminNav({ initials }: { initials: string }) {
  const pathname = usePathname()
  return (
    <nav
      className="shrink-0 flex flex-col items-center py-4 gap-1.5 border-r"
      style={{ width: 96, background: "#F5EEE3", borderColor: "#E8DFD2" }}
      aria-label="Admin navigation"
    >
      <Link href="/admin" className="mb-3" aria-label="Home">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/efl-logo.png" alt="Edwards Family Law" className="w-16 h-16 object-contain" />
      </Link>

      <div className="flex flex-col items-center gap-1.5 flex-1">
        {ITEMS.map((it) => {
          const active = it.match(pathname)
          return (
            <Link
              key={it.href}
              href={it.href}
              title={it.label}
              aria-label={it.label}
              className="w-[84px] py-2.5 rounded-xl flex flex-col items-center gap-1.5 transition-colors"
              style={{ background: active ? "#1B2D45" : "transparent", color: active ? "#fff" : "#4b443b" }}
            >
              <span className="text-[23px] leading-none">{it.icon}</span>
              <span className="text-[11px] font-medium leading-tight">{it.label}</span>
            </Link>
          )
        })}
      </div>

      <div className="mt-auto flex flex-col items-center gap-2">
        <div className="w-10 h-10 rounded-full flex items-center justify-center text-[12px] font-semibold" style={{ background: "#F0E7DA", color: "#4b443b" }} title="Signed in">
          {initials}
        </div>
        <div className="text-[10px]" style={{ color: "#94A3B8" }}>
          <SignOutButton />
        </div>
      </div>
    </nav>
  )
}
