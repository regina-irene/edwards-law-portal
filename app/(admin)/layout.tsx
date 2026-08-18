// app/(admin)/layout.tsx
import { redirect } from "next/navigation"
import { requireAdmin } from "@/lib/admin"
import AdminNav from "@/components/admin/AdminNav"
import Motif from "@/components/ui/Motif"
import FirmAnnouncementBanner from "@/components/announcement/FirmAnnouncementBanner"
import SchemeDecor from "@/components/ui/SchemeDecor"
import { getFirmAnnouncement } from "@/lib/firm-announcement"
import { getAdminPrefs } from "@/lib/admin-prefs"
import { resolveScheme, isDarkSidebar, DEFAULT_SCHEME_KEY } from "@/lib/color-schemes"

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const check = await requireAdmin()
  if (check.status !== "ok") redirect("/login")

  const initials = check.email.replace(/@.*/, "").slice(0, 2).toUpperCase() || "EFL"
  const today = new Date().toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric", timeZone: "America/New_York" })
  const [firmAnnouncement, prefs] = await Promise.all([getFirmAnnouncement(), getAdminPrefs()])

  // Appearance (2026-08-18). Until an admin actively picks a look, the admin
  // side keeps its original cream page + white nav exactly as it was.
  const untouched = prefs.scheme === DEFAULT_SCHEME_KEY && !prefs.gradient
  const scheme = resolveScheme(prefs.scheme, prefs.gradient)
  const dark = isDarkSidebar(scheme)
  const nav = untouched
    ? { bg: "#FFFFFF", activeBg: "#1B2D45", activeInk: "#ffffff", ink: "#4b443b", chipBg: "#F0E7DA", chipInk: "#4b443b", border: "#E8DFD2" }
    : {
        bg: scheme.sidebarBg,
        activeBg: scheme.navActiveBg,
        activeInk: scheme.navActiveInk,
        ink: scheme.navInk,
        chipBg: dark ? "rgba(255,255,255,.18)" : "#F0E7DA",
        chipInk: dark ? "#ffffff" : "#4b443b",
        border: scheme.metaBorder,
      }

  return (
    <div
      className="flex min-h-screen"
      style={{
        background: untouched ? "#FBF8F3" : scheme.pageBg,
        ["--scheme-accent" as string]: scheme.accent,
        ["--scheme-heading" as string]: scheme.heading,
        ["--scheme-title-emoji" as string]:
          !untouched && scheme.titleEmoji ? `"${scheme.titleEmoji} "` : '""',
      }}
    >
      <AdminNav initials={initials} nav={nav} />
      <Motif />
      {/* Seasonal emoji layer + festive stripe, same as the client side gets.
          Both no-op on everyday schemes and while the admin look is untouched. */}
      {!untouched && <SchemeDecor scheme={scheme} />}
      <div className="flex-1 flex flex-col min-h-0">
        {!untouched && scheme.stripe && (
          <div className="h-2.5 shrink-0 print:hidden" style={{ background: scheme.stripe }} />
        )}
        <div className="flex items-center justify-between px-6 py-2 border-b" style={{ borderColor: nav.border }}>
          <span className="section-label">{today}</span>
          <span className="text-[12px]" style={{ color: "#334155" }}>Edwards Family Law · Admin</span>
        </div>
        <FirmAnnouncementBanner initialHtml={firmAnnouncement} />
        <main className="flex-1 px-6 py-8 md:px-10 overflow-auto relative z-10">{children}</main>
      </div>
    </div>
  )
}
