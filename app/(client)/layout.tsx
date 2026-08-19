// app/(client)/layout.tsx
import { redirect } from "next/navigation"
import { Suspense } from "react"
import { getSession, getPortalClient, getActivePreviewEmail } from "@/lib/portal-client"
import { stopPreview } from "@/app/preview-actions"
import { sql } from "@/lib/db"
import Sidebar from "@/components/nav/Sidebar"
import BottomNav from "@/components/nav/BottomNav"
import Motif from "@/components/ui/Motif"
import { getClientNav } from "@/lib/portal-pages"
import { getClientPrefs } from "@/lib/client-prefs"
import { resolveScheme } from "@/lib/color-schemes"
import SchemeDecor from "@/components/ui/SchemeDecor"
import { getJokeOfTheDay } from "@/lib/joke"
import { getFirmAnnouncement } from "@/lib/firm-announcement"
import { FirmAnnouncementView } from "@/components/announcement/FirmAnnouncementView"

// The joke comes from an external API (icanhazdadjoke.com). Awaiting it in the
// layout meant a third-party outage or slow response held up the whole portal.
// As its own streamed component the page paints first and the joke drops in.
async function JokeStrip() {
  const joke = await getJokeOfTheDay().catch(() => null)
  if (!joke) return null
  return (
    <div
      className="px-6 py-1.5 text-center text-sm italic border-b print:hidden"
      style={{ color: "#4b443b", background: "rgba(255,255,255,0.85)", borderColor: "#E8DFD2" }}
    >
      😄 {joke}
    </div>
  )
}

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
  const session = await getSession()
  if (!session?.user?.email) redirect("/login")

  // These two used to be awaited one after the other, and each re-ran auth()
  // internally. They're now deduped by React cache and started together.
  const [clientResult, previewEmail] = await Promise.all([
    getPortalClient().catch((e) => {
      console.error("[layout] getPortalClient failed:", e)
      return null
    }),
    getActivePreviewEmail(),
  ])
  const client = clientResult
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
  const scheme = resolveScheme(prefs.scheme, prefs.gradient)

  const today = new Date().toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric", timeZone: "America/New_York" })
  // Airtable names are "Last | First" — greet the client by first name only
  const firstName = (client.name.split("|")[1] ?? client.name).trim()

  return (
    <div
      className="flex min-h-screen"
      style={{
        background: scheme.pageBg,
        ["--scheme-accent" as string]: scheme.accent,
        ["--scheme-heading" as string]: scheme.heading,
        ["--sidebar-bg" as string]: scheme.sidebarBg,
        ["--sidebar-logo-bg" as string]: scheme.sidebarLogoBg,
        ["--nav-ink" as string]: scheme.navInk,
        ["--nav-hover-bg" as string]: scheme.navHoverBg,
        ["--nav-active-bg" as string]: scheme.navActiveBg,
        ["--nav-active-ink" as string]: scheme.navActiveInk,
        ["--scheme-title-emoji" as string]: scheme.titleEmoji ? `"${scheme.titleEmoji} "` : '""',
      }}
    >
      <Sidebar pages={pages} unreadMessages={unread.messages} unreadChat={unread.chat} baseEmoji={scheme.titleEmoji} />
      {/* Phones only: the icon rail is hidden below `md`, so the same pages sit
          in a fixed bottom tab bar instead. */}
      <BottomNav pages={pages} unreadChat={unread.chat} />
      <Motif />
      <SchemeDecor scheme={scheme} />
      <div className="flex-1 flex flex-col min-h-0">
        {scheme.stripe && <div className="h-2.5 shrink-0 print:hidden" style={{ background: scheme.stripe }} />}
        {previewEmail && (
          <div className="bg-amber-100 border-b border-amber-300 text-amber-900 text-sm px-4 py-2 flex items-center justify-center gap-3 print:hidden">
            <span>Admin preview — viewing the portal as <strong>{client.name}</strong></span>
            <form action={stopPreview}>
              <button type="submit" className="underline font-medium hover:text-amber-950">Exit preview</button>
            </form>
          </div>
        )}
        {/* Meta strip */}
        <div className="flex items-center justify-between px-6 py-2 border-b print:hidden" style={{ borderColor: scheme.metaBorder }}>
          <span className="section-label">{today}</span>
          <span className="text-[12px]" style={{ color: "#334155" }}>{firstName}</span>
        </div>
        <FirmAnnouncementView html={firmAnnouncement} />
        {prefs.showJoke && (
          <Suspense fallback={null}>
            <JokeStrip />
          </Suspense>
        )}
        {/* pb-24 below `md` keeps page content and the message composer clear
            of the fixed bottom tab bar; pt-8 + md:pb-8 is the old py-8. */}
        <main className="flex-1 px-6 pt-8 pb-24 md:px-10 md:pb-8 overflow-auto relative z-10">{children}</main>
      </div>
    </div>
  )
}
