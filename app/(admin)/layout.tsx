// app/(admin)/layout.tsx
import { redirect } from "next/navigation"
import { requireAdmin } from "@/lib/admin"
import AdminNav from "@/components/admin/AdminNav"
import SignOutButton from "@/components/admin/SignOutButton"

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const check = await requireAdmin()
  if (check.status !== "ok") redirect("/login")

  const today = new Date().toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })

  return (
    <div className="flex min-h-screen" style={{ background: "#FFFFFF" }}>
      <aside className="w-56 shrink-0 flex flex-col border-r" style={{ borderColor: "#E2E8F0", background: "#F5F5F4" }}>
        <div className="px-5 py-4 border-b flex items-center gap-2.5" style={{ borderColor: "#E2E8F0" }}>
          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-serif font-bold" style={{ background: "#1A2A4A" }}>E</div>
          <div className="min-w-0">
            <p className="section-label">Admin</p>
            <p className="text-[11px] truncate" style={{ color: "#64748B" }}>{check.email}</p>
          </div>
        </div>
        <AdminNav />
        <div className="mt-auto p-4 border-t" style={{ borderColor: "#E2E8F0" }}>
          <SignOutButton />
        </div>
      </aside>
      <div className="flex-1 flex flex-col min-h-0">
        <div className="flex items-center justify-between px-6 py-2 border-b" style={{ borderColor: "#E2E8F0" }}>
          <span className="section-label">{today}</span>
          <span className="text-[12px]" style={{ color: "#334155" }}>Edwards Family Law · Admin</span>
        </div>
        <main className="flex-1 px-6 py-6 overflow-auto">{children}</main>
      </div>
    </div>
  )
}
