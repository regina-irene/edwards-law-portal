"use client"
// components/nav/BottomNav.tsx - phone-only bottom tab bar. Below `md` the left
// icon rail is hidden and this stands in for it, down where a thumb can reach.
// Same pages, same unread badges and the same active styling as the rail.
// At `md` and up it is not rendered at all.

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { signOut } from "next-auth/react"
import { navIcon, navUnread } from "./nav-meta"
import type { NavPage } from "@/lib/portal-pages"

interface BottomNavProps {
  pages: NavPage[]
  unreadChat: number
}

// Four tabs plus "More" is the most that fits across a 320px phone without the
// labels squashing, so anything past the fourth page lives in the More sheet.
// Sign out lives there too, since it is otherwise only in the hidden icon rail.
const MAX_TABS = 4

function isActive(pathname: string, href: string): boolean {
  // Identical rule to NavItem so a page is marked current in both navs.
  return pathname === href || pathname.startsWith(href + "/")
}

function TabBadge({ count }: { count: number }) {
  if (count <= 0) return null
  return (
    <span className="absolute top-1 right-1.5 inline-flex items-center justify-center min-w-[16px] h-4 px-1 text-[9px] font-bold rounded-full bg-red-500 text-white">
      {count > 9 ? "9+" : count}
    </span>
  )
}

export default function BottomNav({ pages, unreadChat }: BottomNavProps) {
  const pathname = usePathname()
  const [moreOpen, setMoreOpen] = useState(false)

  // Tapping a page inside the sheet navigates; close the sheet once it lands.
  useEffect(() => {
    setMoreOpen(false)
  }, [pathname])

  const tabs: NavPage[] = pages.slice(0, MAX_TABS)
  const rest: NavPage[] = pages.slice(MAX_TABS)
  const restUnread: number = rest.reduce((n, p) => n + navUnread(p.key, unreadChat), 0)
  const restActive: boolean = rest.some((p) => isActive(pathname, p.href))

  const tabClass = (active: boolean): string =>
    `nav-item relative flex-1 min-w-0 min-h-[52px] rounded-xl flex flex-col items-center justify-center gap-1 px-0.5 py-1.5 transition-colors ${
      active ? "nav-item-active" : ""
    }`

  return (
    <>
      {moreOpen && (
        <div className="no-print md:hidden print:hidden fixed inset-0 z-40">
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setMoreOpen(false)}
            className="absolute inset-0 w-full bg-black/40"
          />
          <div className="absolute inset-x-3 bottom-[5.5rem] rounded-2xl border border-gray-200 bg-white shadow-xl overflow-hidden">
            <p className="px-4 py-3 text-xs uppercase tracking-wide text-gray-500 font-semibold border-b border-gray-200">
              More
            </p>
            {rest.length > 0 && (
              <div className="max-h-[50dvh] overflow-auto">
                {rest.map((p) => {
                  const active = isActive(pathname, p.href)
                  const unread = navUnread(p.key, unreadChat)
                  return (
                    <Link
                      key={p.key}
                      href={p.href}
                      aria-current={active ? "page" : undefined}
                      className={`flex items-center gap-3 px-4 min-h-[52px] border-b border-gray-100 last:border-b-0 ${
                        active ? "bg-gray-50 font-semibold text-gray-900" : "text-gray-700"
                      }`}
                    >
                      <span aria-hidden="true" className="text-[20px] leading-none">{navIcon(p.key)}</span>
                      <span className="text-sm">{p.label}</span>
                      {unread > 0 && (
                        <span className="ml-auto inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold rounded-full bg-red-500 text-white">
                          {unread > 9 ? "9+" : unread}
                        </span>
                      )}
                    </Link>
                  )
                })}
              </div>
            )}
            <button
              type="button"
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="w-full px-4 min-h-[52px] flex items-center text-sm font-medium text-gray-600 border-t border-gray-200"
            >
              Sign out
            </button>
          </div>
        </div>
      )}

      <nav
        aria-label="Portal pages"
        className="no-print md:hidden print:hidden fixed bottom-0 inset-x-0 z-50 border-t bottom-nav-safe"
        style={{ borderColor: "#E8DFD2", background: "var(--sidebar-bg, #F5EEE3)" }}
      >
        <div className="flex items-stretch px-1 pt-1">
          {tabs.map((p) => {
            const active = isActive(pathname, p.href)
            return (
              <Link
                key={p.key}
                href={p.href}
                aria-label={p.label}
                aria-current={active ? "page" : undefined}
                className={tabClass(active)}
              >
                <span aria-hidden="true" className="text-[20px] leading-none">{navIcon(p.key)}</span>
                <span className="text-[10px] font-medium leading-tight text-center break-words">{p.label}</span>
                <TabBadge count={navUnread(p.key, unreadChat)} />
              </Link>
            )
          })}
          <button
            type="button"
            onClick={() => setMoreOpen((v) => !v)}
            aria-expanded={moreOpen}
            aria-label="More pages"
            className={tabClass(restActive || moreOpen)}
          >
            <span aria-hidden="true" className="text-[20px] leading-none">☰</span>
            <span className="text-[10px] font-medium leading-tight text-center">More</span>
            <TabBadge count={restUnread} />
          </button>
        </div>
      </nav>
    </>
  )
}
