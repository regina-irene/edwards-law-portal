// components/nav/nav-meta.ts — icons and unread-badge rules shared by the
// desktop icon rail (Sidebar) and the phone bottom bar (BottomNav), so the two
// can never drift apart.

export const NAV_ICONS: Record<string, string> = {
  dashboard: "🏠",
  pleadings: "⚖️",
  correspondence: "📬",
  discovery: "🔎",
  status: "📊",
  tasks: "✅",
  calendar: "📅",
  messages: "✉️",
  chat: "💬",
  settings: "⚙️",
}

export function navIcon(key: string): string {
  return NAV_ICONS[key] ?? "📄"
}

// The Messages page reads chat_messages, so its badge must count chat_messages
// too. It previously counted the legacy `messages` table, which meant a real
// reply from the firm produced no badge while a legacy row produced one the
// client could never clear by reading anything. (2026-08-18)
// Deliberately NOT counting the legacy `messages` table: nothing in the
// client UI reads it any more, so those rows could never be cleared and the
// badge would stick forever.
export function navUnread(key: string, unreadChat: number): number {
  return key === "messages" || key === "chat" ? unreadChat : 0
}
