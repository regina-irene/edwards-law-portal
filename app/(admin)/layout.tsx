// app/(admin)/layout.tsx
import { redirect } from "next/navigation"
import { requireAdmin } from "@/lib/admin"
import Link from "next/link"

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const check = await requireAdmin()
  if (check.status !== "ok") redirect("/login")

  return (
    <div className="flex min-h-screen bg-gray-50">
      <aside className="w-56 min-h-screen bg-white border-r border-gray-200">
        <div className="p-5 border-b border-gray-100">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Admin</p>
          <p className="text-sm text-gray-600 mt-0.5 truncate">{check.email}</p>
        </div>
        <nav className="p-3 space-y-1">
          <Link href="/admin" className="block px-3 py-2 rounded-lg text-sm text-gray-700 hover:bg-gray-100">
            Clients
          </Link>
          <Link href="/admin/settings" className="block px-3 py-2 rounded-lg text-sm text-gray-700 hover:bg-gray-100">
            Settings
          </Link>
        </nav>
      </aside>
      <main className="flex-1 p-8">{children}</main>
    </div>
  )
}
