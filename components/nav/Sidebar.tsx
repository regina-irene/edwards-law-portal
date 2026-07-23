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
  baseEmoji?: string | null
}

export default function Sidebar({ pages, unreadMessages, unreadChat, baseEmoji }: SidebarProps) {
  const getUnread = (key: string) => (key === "messages" ? unreadMessages : key === "chat" ? unreadChat : 0)

  return (
    <aside
      className="w-24 shrink-0 flex flex-col items-center py-4 gap-1.5 border-r print:hidden"
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
          <NavItem key={p.key} href={p.href} label={p.label} icon={ICONS[p.key] ?? "📄"} unreadCount={getUnread(p.key)} />
        ))}
      </nav>
      {baseEmoji && <div aria-hidden="true" className="text-2xl pb-1">{baseEmoji}</div>}
      <div className="pt-2">
        <SignOutButton />
      </div>
    </aside>
  )
}
