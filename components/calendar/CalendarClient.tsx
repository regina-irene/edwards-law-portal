"use client"
// components/calendar/CalendarClient.tsx — the client's case calendar with
// Month / Week / Agenda views, replacing the Airtable embed.

import { useMemo, useState } from "react"
import type { CaseEvent } from "@/lib/calendar"

type View = "month" | "week" | "agenda"

const NAVY = "#1b2d45"

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

function eventDay(e: CaseEvent): string {
  return ymd(new Date(e.start))
}

function timeOf(e: CaseEvent): string {
  if (e.allDay) return "All day"
  return new Date(e.start).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
}

function longDay(d: Date): string {
  return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })
}

function mapsUrl(location: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`
}

function LocationLink({ location, className = "" }: { location: string; className?: string }) {
  return (
    <a
      href={mapsUrl(location)}
      target="_blank"
      rel="noopener noreferrer"
      className={`underline hover:opacity-75 ${className}`}
      title="Open in Google Maps"
    >
      📍 {location}
    </a>
  )
}

function ZoomLink({ url, className = "" }: { url: string; className?: string }) {
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className={`underline hover:opacity-75 ${className}`} title="Join Zoom meeting">
      🎥 Join Zoom
    </a>
  )
}

function EventChip({ e, detailed = false }: { e: CaseEvent; detailed?: boolean }) {
  return (
    <div
      className={`rounded-md px-1.5 py-0.5 text-[11px] leading-tight font-medium truncate ${detailed ? "px-3 py-2 text-sm whitespace-normal" : ""}`}
      style={{ background: "#dceefb", color: NAVY }}
      title={`${e.title}${e.location ? ` · ${e.location}` : ""}`}
    >
      <span className="font-semibold">{timeOf(e)}</span> {e.title}
      {detailed && e.location && <LocationLink location={e.location} className="block text-xs opacity-90" />}
      {detailed && e.zoomLink && <ZoomLink url={e.zoomLink} className="block text-xs font-semibold" />}
    </div>
  )
}

export default function CalendarClient({ events }: { events: CaseEvent[] }) {
  const [view, setView] = useState<View>("agenda")
  const [cursor, setCursor] = useState(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d
  })

  const byDay = useMemo(() => {
    const m = new Map<string, CaseEvent[]>()
    for (const e of events) {
      const k = eventDay(e)
      if (!m.has(k)) m.set(k, [])
      m.get(k)!.push(e)
    }
    return m
  }, [events])

  const todayKey = ymd(new Date())

  function move(dir: -1 | 1) {
    const d = new Date(cursor)
    if (view === "month") d.setMonth(d.getMonth() + dir)
    else if (view === "week") d.setDate(d.getDate() + dir * 7)
    setCursor(d)
  }

  // ---- month grid ----
  const monthCells = useMemo(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1)
    const start = new Date(first)
    start.setDate(1 - first.getDay()) // back to Sunday
    const cells: Date[] = []
    for (let i = 0; i < 42; i++) {
      const d = new Date(start)
      d.setDate(start.getDate() + i)
      cells.push(d)
    }
    return cells
  }, [cursor])

  // ---- week days ----
  const weekDays = useMemo(() => {
    const start = new Date(cursor)
    start.setDate(cursor.getDate() - cursor.getDay())
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start)
      d.setDate(start.getDate() + i)
      return d
    })
  }, [cursor])

  // ---- agenda: upcoming events ----
  const agenda = useMemo(() => {
    const now = new Date()
    now.setHours(0, 0, 0, 0)
    return events.filter((e) => new Date(e.start) >= now)
  }, [events])

  const heading =
    view === "month"
      ? cursor.toLocaleDateString("en-US", { month: "long", year: "numeric" })
      : view === "week"
        ? `Week of ${weekDays[0].toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${weekDays[6].toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`
        : "Upcoming"

  return (
    <div className="bg-white rounded-lg border border-gray-200">
      {/* toolbar */}
      <div className="flex items-center justify-between gap-3 flex-wrap px-4 py-3 border-b border-gray-200">
        <div className="flex items-center gap-2">
          {view !== "agenda" && (
            <>
              <button onClick={() => move(-1)} className="px-2.5 py-1 rounded-lg border border-gray-300 text-sm hover:bg-gray-50" aria-label="Previous">←</button>
              <button onClick={() => move(1)} className="px-2.5 py-1 rounded-lg border border-gray-300 text-sm hover:bg-gray-50" aria-label="Next">→</button>
              <button onClick={() => { const d = new Date(); d.setHours(0, 0, 0, 0); setCursor(d) }} className="px-3 py-1 rounded-lg border border-gray-300 text-sm hover:bg-gray-50">Today</button>
            </>
          )}
          <span className="text-sm font-semibold ml-1" style={{ color: NAVY }}>{heading}</span>
        </div>
        <div className="flex rounded-lg border border-gray-300 overflow-hidden text-sm">
          {(["agenda", "month", "week"] as View[]).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className="px-3.5 py-1.5 capitalize"
              style={view === v ? { background: NAVY, color: "#fff", fontWeight: 600 } : { color: "#374151" }}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {/* month view */}
      {view === "month" && (
        <div>
          <div className="grid grid-cols-7 text-center text-[11px] uppercase tracking-wide text-gray-400 border-b border-gray-100">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => <div key={d} className="py-1.5">{d}</div>)}
          </div>
          <div className="grid grid-cols-7">
            {monthCells.map((d, i) => {
              const k = ymd(d)
              const inMonth = d.getMonth() === cursor.getMonth()
              const dayEvents = byDay.get(k) ?? []
              return (
                <div key={i} className={`min-h-20 border-b border-r border-gray-100 p-1 ${inMonth ? "" : "bg-gray-50/60"}`}>
                  <span
                    className={`inline-flex items-center justify-center w-5 h-5 text-[11px] rounded-full mb-0.5 ${k === todayKey ? "text-white font-bold" : inMonth ? "text-gray-700" : "text-gray-300"}`}
                    style={k === todayKey ? { background: NAVY } : undefined}
                  >
                    {d.getDate()}
                  </span>
                  <div className="space-y-0.5">
                    {dayEvents.slice(0, 3).map((e) => <EventChip key={e.id} e={e} />)}
                    {dayEvents.length > 3 && <p className="text-[10px] text-gray-400 pl-1">+{dayEvents.length - 3} more</p>}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* week view */}
      {view === "week" && (
        <div className="grid grid-cols-1 sm:grid-cols-7 divide-y sm:divide-y-0 sm:divide-x divide-gray-100">
          {weekDays.map((d) => {
            const k = ymd(d)
            const dayEvents = byDay.get(k) ?? []
            return (
              <div key={k} className={`p-2 min-h-32 ${k === todayKey ? "bg-blue-50/50" : ""}`}>
                <p className="text-[11px] uppercase tracking-wide text-gray-400">{d.toLocaleDateString("en-US", { weekday: "short" })}</p>
                <p className={`text-sm font-semibold mb-1.5 ${k === todayKey ? "" : "text-gray-700"}`} style={k === todayKey ? { color: NAVY } : undefined}>
                  {d.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </p>
                <div className="space-y-1">
                  {dayEvents.map((e) => <EventChip key={e.id} e={e} detailed />)}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* agenda view */}
      {view === "agenda" && (
        <div className="divide-y divide-gray-100">
          {agenda.length === 0 && <p className="text-sm text-gray-500 p-6">No upcoming events on your calendar.</p>}
          {agenda.map((e) => (
            <div key={e.id} className="flex items-start gap-4 px-5 py-3.5">
              <div className="w-40 shrink-0">
                <p className="text-sm font-semibold text-gray-900">{longDay(new Date(e.start))}</p>
                <p className="text-xs text-gray-500">{timeOf(e)}</p>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-900">{e.title}</p>
                {e.location && <p className="text-xs text-gray-600 mt-0.5"><LocationLink location={e.location} /></p>}
                {e.zoomLink && (
                  <p className="text-xs mt-0.5">
                    <a href={e.zoomLink} target="_blank" rel="noopener noreferrer" className="underline break-all text-gray-500 hover:opacity-75">
                      🎥 {e.zoomLink}
                    </a>
                  </p>
                )}
                {e.description && <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{e.description}</p>}
              </div>
              {e.zoomLink && (
                <a href={e.zoomLink} target="_blank" rel="noopener noreferrer" className="shrink-0 text-sm font-semibold px-3.5 py-1.5 rounded-lg text-white hover:opacity-90" style={{ background: NAVY }}>
                  🎥 Join Zoom
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
