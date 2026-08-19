// components/nav/Sidebar.tsx — the desktop icon rail. Hidden below `md`, where
// BottomNav takes over; unchanged at `md` and above.
import NavItem from "./NavItem"
import SignOutButton from "./SignOutButton"
import { navIcon, navUnread } from "./nav-meta"
import type { NavPage } from "@/lib/portal-pages"

interface SidebarProps {
  pages: NavPage[]
  unreadMessages: number
  unreadChat: number
  baseEmoji?: string | null
}

export default function Sidebar({ pages, unreadChat, baseEmoji }: SidebarProps) {
  // Icons and the unread-badge rule live in ./nav-meta so the bottom bar shows
  // exactly the same thing.
  return (
    <aside
      className="w-24 shrink-0 hidden md:flex flex-col items-center py-4 gap-1.5 border-r print:hidden"
      style={{ borderColor: "#E8DFD2", background: "var(--sidebar-bg, #F5EEE3)" }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/efl-logo.png"
        alt="Edwards Family Law"
        className="mb-3 w-16 h-16 object-contain rounded-xl p-0.5"
        style={{ background: "var(--sidebar-logo-bg, transparent)" }}
      />
      <nav className="flex-1 flex flex-col items-center gap-1">
        {pages.map((p) => (
          <NavItem key={p.key} href={p.href} label={p.label} icon={navIcon(p.key)} unreadCount={navUnread(p.key, unreadChat)} />
        ))}
      </nav>
      {baseEmoji && <div aria-hidden="true" className="text-2xl pb-1">{baseEmoji}</div>}
      <div className="pt-2">
        <SignOutButton />
      </div>
    </aside>
  )
}
