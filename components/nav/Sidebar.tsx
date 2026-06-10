// components/nav/Sidebar.tsx
import NavItem from "./NavItem"
import SignOutButton from "./SignOutButton"
import type { NavPage } from "@/lib/portal-pages"

const ICONS: Record<string, string> = {
  dashboard: "🏠",
  pleadings: "⚖️",
  discovery: "🔎",
  status: "📊",
  tasks: "✅",
  calendar: "📅",
  messages: "✉️",
  chat: "💬",
  settings: "⚙️",
}

interface SidebarProps {
  pages: NavPage[]
  unreadMessages: number
  unreadChat: number
}

export default function Sidebar({ pages, unreadMessages, unreadChat }: SidebarProps) {
  const getUnread = (key: string) => (key === "messages" ? unreadMessages : key === "chat" ? unreadChat : 0)

  return (
    <aside
      className="w-24 shrink-0 flex flex-col items-center py-4 gap-1.5 border-r print:hidden"
      style={{ borderColor: "#E8DFD2", background: "#F5EEE3" }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/efl-logo.png" alt="Edwards Family Law" className="mb-3 w-16 h-16 object-contain" />
      <nav className="flex-1 flex flex-col items-center gap-1">
        {pages.map((p) => (
          <NavItem key={p.key} href={p.href} label={p.label} icon={ICONS[p.key] ?? "📄"} unreadCount={getUnread(p.key)} />
        ))}
      </nav>
      <div className="pt-2">
        <SignOutButton />
      </div>
    </aside>
  )
}
