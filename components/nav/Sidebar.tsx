// components/nav/Sidebar.tsx
import NavItem from "./NavItem"
import SignOutButton from "./SignOutButton"
import type { NavPage } from "@/lib/portal-pages"

interface SidebarProps {
  pages: NavPage[]
  clientName: string
  unreadMessages: number
  unreadChat: number
}

export default function Sidebar({ pages, clientName, unreadMessages, unreadChat }: SidebarProps) {
  const getUnread = (key: string) => {
    if (key === "messages") return unreadMessages
    if (key === "chat") return unreadChat
    return 0
  }

  return (
    <aside className="w-64 min-h-screen bg-white border-r border-gray-200 flex flex-col">
      <div className="p-6 border-b border-gray-100">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Edwards Family Law</p>
        <p className="mt-1 text-sm font-medium text-gray-900 truncate">{clientName}</p>
      </div>
      <nav className="flex-1 p-3 space-y-1">
        {pages.map((p) => (
          <NavItem key={p.key} href={p.href} label={p.label} unreadCount={getUnread(p.key)} />
        ))}
      </nav>
      <div className="p-4 border-t border-gray-100">
        <SignOutButton />
      </div>
    </aside>
  )
}
