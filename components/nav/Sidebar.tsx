// components/nav/Sidebar.tsx
import NavItem from "./NavItem"
import SignOutButton from "./SignOutButton"
import type { NavPage } from "@/lib/portal-pages"

const ICONS: Record<string, string> = {
  dashboard: "🏠",
  "document-requests": "📄",
  pleadings: "⚖️",
  discovery: "🔎",
  status: "📊",
  tasks: "✅",
  calendar: "📅",
  messages: "✉️",
  chat: "💬",
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
      className="w-20 shrink-0 flex flex-col items-center py-3 gap-1 border-r"
      style={{ borderColor: "#E8DFD2", background: "#F5EEE3" }}
    >
      <div
        className="mb-2 w-9 h-9 rounded-lg flex items-center justify-center text-white font-serif font-bold"
        style={{ background: "#1B2D45" }}
        title="Edwards Family Law"
      >
        E
      </div>
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
