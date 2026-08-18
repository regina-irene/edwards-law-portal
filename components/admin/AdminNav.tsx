"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import SignOutButton from "@/components/admin/SignOutButton"

const ITEMS = [
  { href: "/admin", label: "Home", icon: "🏠", match: (p: string) => p === "/admin" },
  { href: "/admin/clients", label: "Clients", icon: "👥", match: (p: string) => p.startsWith("/admin/clients") },
  { href: "/admin/messages", label: "Messages", icon: "✉️", match: (p: string) => p.startsWith("/admin/messages") || p.startsWith("/admin/chat") },
  { href: "/admin/tasks", label: "Tasks", icon: "✅", match: (p: string) => p.startsWith("/admin/tasks") },
  { href: "/admin/notes", label: "Field Notes", icon: "📝", match: (p: string) => p.startsWith("/admin/notes") },
  { href: "/admin/forms", label: "Forms", icon: "📋", match: (p: string) => p.startsWith("/admin/forms") },
  { href: "/admin/pages", label: "Pages", icon: "📄", match: (p: string) => p.startsWith("/admin/pages") },
  { href: "/admin/settings", label: "Settings", icon: "⚙️", match: (p: string) => p.startsWith("/admin/settings") },
]

export interface AdminNavColors {
  bg: string
  activeBg: string
  activeInk: string
  ink: string
  chipBg: string
  chipInk: string
  border: string
}

// Original hardcoded admin colors — used when the layout supplies nothing.
const DEFAULT_NAV: AdminNavColors = {
  bg: "#FFFFFF", activeBg: "#1B2D45", activeInk: "#ffffff", ink: "#4b443b",
  chipBg: "#F0E7DA", chipInk: "#4b443b", border: "#E8DFD2",
}

export default function AdminNav({ initials, nav = DEFAULT_NAV }: { initials: string; nav?: AdminNavColors }) {
  const pathname = usePathname()
  return (
    <nav
      className="shrink-0 flex flex-col items-center py-4 gap-1.5 border-r"
      style={{ width: 96, background: nav.bg, borderColor: nav.border }}
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
              style={{ background: active ? nav.activeBg : "transparent", color: active ? nav.activeInk : nav.ink }}
            >
              <span className="text-[23px] leading-none">{it.icon}</span>
              <span className="text-[11px] font-medium leading-tight">{it.label}</span>
            </Link>
          )
        })}
      </div>

      <div className="mt-auto flex flex-col items-center gap-2">
        <div className="w-10 h-10 rounded-full flex items-center justify-center text-[12px] font-semibold" style={{ background: nav.chipBg, color: nav.chipInk }} title="Signed in">
          {initials}
        </div>
        <div className="text-[10px]" style={{ color: "#94A3B8" }}>
          <SignOutButton />
        </div>
      </div>
    </nav>
  )
}
