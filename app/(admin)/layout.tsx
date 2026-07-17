// app/(admin)/layout.tsx
import { redirect } from "next/navigation"
import { requireAdmin } from "@/lib/admin"
import AdminNav from "@/components/admin/AdminNav"
import Motif from "@/components/ui/Motif"
import FirmAnnouncementBanner from "@/components/announcement/FirmAnnouncementBanner"
import { getFirmAnnouncement } from "@/lib/firm-announcement"

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const check = await requireAdmin()
  if (check.status !== "ok") redirect("/login")

  const initials = check.email.replace(/@.*/, "").slice(0, 2).toUpperCase() || "EFL"
  const today = new Date().toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric", timeZone: "America/New_York" })
  const firmAnnouncement = await getFirmAnnouncement()

  return (
    <div className="flex min-h-screen" style={{ background: "#FBF8F3" }}>
      <AdminNav initials={initials} />
      <Motif />
      <div className="flex-1 flex flex-col min-h-0">
        <div className="flex items-center justify-between px-6 py-2 border-b" style={{ borderColor: "#E8DFD2" }}>
          <span className="section-label">{today}</span>
          <span className="text-[12px]" style={{ color: "#334155" }}>Edwards Family Law · Admin</span>
        </div>
        <FirmAnnouncementBanner initialHtml={firmAnnouncement} />
        <main className="flex-1 px-6 py-6 overflow-auto">{children}</main>
      </div>
    </div>
  )
}
