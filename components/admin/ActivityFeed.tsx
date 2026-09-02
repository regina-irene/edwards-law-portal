"use client"
// components/admin/ActivityFeed.tsx - the dashboard's activity feed with type
// filter chips and show-more paging. Receives pre-labeled rows from the server
// page; dismissing calls the same server action as before.
import Link from "next/link"
import { useState } from "react"
import { dismissActivity } from "@/app/(admin)/admin/actions"

export interface ActivityItem {
  id: string
  kind: string
  name: string
  text: string
  href: string
  at: string // ISO timestamp
}

const FILTERS: { key: string; label: string; kinds: string[] | null }[] = [
  { key: "all", label: "All", kinds: null },
  { key: "messages", label: "💬 Messages", kinds: ["chat", "message"] },
  { key: "uploads", label: "📎 Uploads", kinds: ["upload"] },
  { key: "forms", label: "📝 Forms", kinds: ["form"] },
  { key: "signins", label: "🔑 Sign-ins", kinds: ["link_sent", "sign_in"] },
  { key: "notes", label: "📌 Field Notes", kinds: ["note"] },
]

const ICON: Record<string, string> = {
  chat: "💬", message: "💬", upload: "📎", form: "📝", link_sent: "🔑", sign_in: "🔑", note: "📌",
}

const PAGE = 25

function relTime(d: string): string {
  const diff = Date.now() - new Date(d).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return "just now"
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const days = Math.floor(h / 24)
  if (days < 7) return `${days}d ago`
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

export default function ActivityFeed({ items }: { items: ActivityItem[] }) {
  const [filter, setFilter] = useState("all")
  const [client, setClient] = useState("")
  const [shown, setShown] = useState(PAGE)

  const clientNames = [...new Set(items.map((i) => i.name))].sort((a, b) => a.localeCompare(b))
  const q = client.trim().toLowerCase()
  const byClient = q ? items.filter((i) => i.name.toLowerCase().includes(q)) : items
  const kinds = FILTERS.find((f) => f.key === filter)?.kinds ?? null
  const filtered = kinds ? byClient.filter((i) => kinds.includes(i.kind)) : byClient
  const paged = filtered.slice(0, shown)
  const countFor = (f: (typeof FILTERS)[number]) =>
    f.kinds ? byClient.filter((i) => f.kinds!.includes(i.kind)).length : byClient.length

  return (
    <div>
      <div className="px-5 py-2.5 border-b border-gray-100 flex items-center gap-2 flex-wrap">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => { setFilter(f.key); setShown(PAGE) }}
            className={`px-3 py-1 rounded-full text-xs font-semibold border ${filter === f.key ? "text-white border-transparent" : "bg-white text-gray-600 border-gray-300 hover:border-gray-400"}`}
            style={filter === f.key ? { background: "#1b2d45" } : undefined}
          >
            {f.label} <span className={filter === f.key ? "opacity-70" : "text-gray-400"}>{countFor(f)}</span>
          </button>
        ))}
        <span className="ml-auto flex items-center gap-1">
          <input
            list="activity-clients"
            value={client}
            onChange={(e) => { setClient(e.target.value); setShown(PAGE) }}
            placeholder="All clients - type to filter"
            className="w-48 px-2.5 py-1 rounded-lg text-xs font-medium border border-gray-300 bg-white text-gray-900"
          />
          <datalist id="activity-clients">
            {clientNames.map((n) => <option key={n} value={n} />)}
          </datalist>
          {client && (
            <button type="button" title="Clear" onClick={() => { setClient(""); setShown(PAGE) }} className="text-gray-400 hover:text-gray-700 text-sm px-1">
              ✕
            </button>
          )}
        </span>
      </div>

      {paged.length === 0 ? (
        <div className="px-5 py-12 text-center text-sm text-gray-400">
          {filter === "all" ? "No recent client activity yet." : "Nothing in this category yet."}
        </div>
      ) : (
        <ul className="divide-y divide-gray-100">
          {paged.map((a) => (
            <li key={a.id} className="flex items-center gap-3 px-5 py-3 group hover:bg-[#FBF8F3] transition-colors">
              {/* A file opens in a new tab so the dashboard is still there
                  when you come back; a portal page replaces it, because going
                  to the conversation is the point of the click. */}
              <Link
                href={a.href}
                {...(a.href.startsWith("/api/") || !a.href.startsWith("/")
                  ? { target: "_blank", rel: "noreferrer" }
                  : {})}
                className="flex items-center gap-3 min-w-0 flex-1"
              >
                <span className="w-8 h-8 rounded-full flex items-center justify-center text-sm flex-shrink-0" style={{ background: "#F0E7DA" }}>
                  {ICON[a.kind] ?? "📝"}
                </span>
                <div className="min-w-0 flex-1">
                  {/* Two lines rather than one: the entry now carries the
                      message itself, and a single truncated line cut most of
                      them off at the client's name. */}
                  <p className="text-sm text-gray-800 line-clamp-2 group-hover:text-gray-900">
                    <span className="font-semibold text-gray-900">{a.name}</span> {a.text}
                  </p>
                </div>
              </Link>
              <span className="text-xs text-gray-400 tabular-nums flex-shrink-0">{relTime(a.at)}</span>
              <form action={dismissActivity.bind(null, a.id)} className="flex-shrink-0">
                <button type="submit" title="Clear" className="text-gray-300 hover:text-red-600 text-sm">✕</button>
              </form>
            </li>
          ))}
        </ul>
      )}

      {filtered.length > shown && (
        <div className="px-5 py-3 border-t border-gray-100">
          <button type="button" onClick={() => setShown(shown + PAGE)} className="text-xs text-blue-600 hover:underline">
            Show more ({filtered.length - shown} older)
          </button>
        </div>
      )}
    </div>
  )
}
