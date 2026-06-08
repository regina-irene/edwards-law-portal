"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import SignOutButton from "@/components/admin/SignOutButton"

const ITEMS = [
  { href: "/admin", label: "Clients", icon: "👥", match: (p: string) => p === "/admin" || p.startsWith("/admin/clients") || p.startsWith("/admin/chat") || p.startsWith("/admin/messages") },
  { href: "/admin/tasks", label: "Tasks", icon: "✅", match: (p: string) => p.startsWith("/admin/tasks") },
  { href: "/admin/pages", label: "Pages", icon: "📄", match: (p: string) => p.startsWith("/admin/pages") },
  { href: "/admin/settings", label: "Settings", icon: "⚙️", match: (p: string) => p.startsWith("/admin/settings") },
]

export default function AdminNav({ initials }: { initials: string }) {
  const pathname = usePathname()
  return (
    <nav
      className="shrink-0 flex flex-col items-center py-3 gap-1 border-r"
      style={{ width: 80, background: "#F5F5F4", borderColor: "#E2E8F0" }}
      aria-label="Admin navigation"
    >
      <Link href="/admin" className="mb-2" aria-label="Home">
        <div className="w-10 h-10 rounded-lg flex items-center justify-center text-white text-[11px] font-bold tracking-wider" style={{ background: "#1A2A4A" }}>
          EFL
        </div>
      </Link>

      <div className="flex flex-col items-center gap-1 flex-1">
        {ITEMS.map((it) => {
          const active = it.match(pathname)
          return (
            <Link
              key={it.href}
              href={it.href}
              title={it.label}
              aria-label={it.label}
              className="w-[68px] py-1.5 rounded-lg flex flex-col items-center gap-0.5 transition-colors"
              style={{ background: active ? "#1A2A4A" : "transparent", color: active ? "#fff" : "#334155" }}
            >
              <span className="text-[18px] leading-none">{it.icon}</span>
              <span className="text-[10px] font-medium leading-tight">{it.label}</span>
            </Link>
          )
        })}
      </div>

      <div className="mt-auto flex flex-col items-center gap-2">
        <div className="w-9 h-9 rounded-full flex items-center justify-center text-[11px] font-semibold" style={{ background: "#E7E5E4", color: "#334155" }} title="Signed in">
          {initials}
        </div>
        <div className="text-[10px]" style={{ color: "#94A3B8" }}>
          <SignOutButton />
        </div>
      </div>
    </nav>
  )
}
