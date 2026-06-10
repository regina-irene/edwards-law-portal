// app/(client)/layout.tsx
import { redirect } from "next/navigation"
import { auth } from "@/auth"
import { getPortalClient, getActivePreviewEmail } from "@/lib/portal-client"
import { stopPreview } from "@/app/preview-actions"
import { sql } from "@/lib/db"
import Sidebar from "@/components/nav/Sidebar"
import { getClientNav } from "@/lib/portal-pages"
import { getClientPrefs } from "@/lib/client-prefs"
import { getTheme } from "@/lib/themes"
import { getJokeOfTheDay } from "@/lib/joke"
import { getFirmAnnouncement } from "@/lib/firm-announcement"
import { FirmAnnouncementView } from "@/components/announcement/FirmAnnouncementBanner"

async function getUnreadCounts(clientId: string) {
  try {
    const [msgResult, chatResult] = await Promise.all([
      sql`SELECT COUNT(*) as count FROM messages WHERE client_id = ${clientId} AND read = false`,
      sql`SELECT COUNT(*) as count FROM chat_messages WHERE client_id = ${clientId} AND sender = 'firm' AND read = false`,
    ])
    return {
      messages: parseInt(msgResult.rows[0]?.count ?? "0"),
      chat: parseInt(chatResult.rows[0]?.count ?? "0"),
    }
  } catch {
    return { messages: 0, chat: 0 }
  }
}

export default async function ClientLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session?.user?.email) redirect("/login")

  let client
  try {
    client = await getPortalClient()
  } catch (e) {
    console.error("[layout] getPortalClient failed:", e)
  }
  const previewEmail = await getActivePreviewEmail()
  if (!client) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-xl font-semibold text-gray-900">Access Not Found</h1>
          <p className="mt-2 text-gray-600">
            Your email is not linked to a client account. Please contact your attorney.
          </p>
        </div>
      </div>
    )
  }

  if (!client.clientId) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-xl font-semibold text-gray-900">Account Setup Incomplete</h1>
          <p className="mt-2 text-gray-600">
            Your account is missing a client ID. Please contact your attorney.
          </p>
        </div>
      </div>
    )
  }

  const [pages, unread, prefs, firmAnnouncement] = await Promise.all([
    getClientNav(String(client.clientId)),
    getUnreadCounts(client.clientId),
    getClientPrefs(String(client.clientId)),
    getFirmAnnouncement(),
  ])
  const theme = getTheme(prefs.theme)
  // "light text" can come from a dark theme or the explicit Settings toggle
  const darkText = theme.dark || prefs.lightText
  const joke = prefs.showJoke ? await getJokeOfTheDay() : null

  const today = new Date().toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric", timeZone: "America/New_York" })
  // Airtable names are "Last | First" — greet the client by first name only
  const firstName = (client.name.split("|")[1] ?? client.name).trim()

  return (
    <div className={`flex min-h-screen ${darkText ? "theme-dark" : ""}`} style={{ background: theme.bg, color: darkText && !theme.dark ? "#f4f6fa" : theme.ink }}>
      <Sidebar pages={pages} unreadMessages={unread.messages} unreadChat={unread.chat} />
      <div className="flex-1 flex flex-col min-h-0">
        {previewEmail && (
          <div className="bg-amber-100 border-b border-amber-300 text-amber-900 text-sm px-4 py-2 flex items-center justify-center gap-3 print:hidden">
            <span>Admin preview — viewing the portal as <strong>{client.name}</strong></span>
            <form action={stopPreview}>
              <button type="submit" className="underline font-medium hover:text-amber-950">Exit preview</button>
            </form>
          </div>
        )}
        {/* Meta strip */}
        <div
          className="flex items-center justify-between px-6 py-2 border-b print:hidden"
          style={{ borderColor: darkText ? "rgba(255,255,255,0.15)" : "#E8DFD2" }}
        >
          <span className="section-label" style={darkText ? { color: "rgba(255,255,255,0.75)" } : undefined}>{today}</span>
          <span className="text-[12px]" style={{ color: darkText ? "rgba(255,255,255,0.75)" : "#334155" }}>{firstName}</span>
        </div>
        <FirmAnnouncementView html={firmAnnouncement} dark={darkText} />
        {joke && (
          <div
            className="px-6 py-1.5 text-center text-sm italic border-b print:hidden backdrop-blur-md"
            style={{
              color: darkText ? "rgba(255,255,255,0.92)" : "#4b443b",
              background: darkText ? "rgba(15,23,42,0.7)" : "rgba(255,255,255,0.85)",
              borderColor: darkText ? "rgba(255,255,255,0.2)" : "#E8DFD2",
            }}
          >
            😄 {joke}
          </div>
        )}
        <main className="flex-1 px-6 py-6 overflow-auto">{children}</main>
      </div>
    </div>
  )
}
