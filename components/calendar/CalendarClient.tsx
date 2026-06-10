"use client"
// components/calendar/CalendarClient.tsx — the client's case calendar with
// Month / Week / Agenda views, replacing the Airtable embed.

import { useMemo, useState } from "react"
import type { CaseEvent } from "@/lib/calendar"

type View = "month" | "week" | "twoweeks" | "agenda"

const VIEW_LABELS: Record<View, string> = { agenda: "Agenda", month: "Month", week: "Week", twoweeks: "2 Weeks" }

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

// ---- add-to-calendar helpers ----

function pad(n: number): string {
  return String(n).padStart(2, "0")
}

// UTC stamp "20260714T140000Z" (or date-only "20260714" for all-day events)
function calStamp(iso: string, allDay: boolean, addDays = 0): string {
  const d = new Date(iso)
  d.setDate(d.getDate() + addDays)
  if (allDay) return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}00Z`
}

function eventEnd(e: CaseEvent): string {
  if (e.end) return e.end
  const d = new Date(e.start)
  d.setHours(d.getHours() + 1)
  return d.toISOString()
}

function eventDetails(e: CaseEvent): string {
  return [e.description, e.zoomLink ? `Zoom: ${e.zoomLink}` : ""].filter(Boolean).join("\n")
}

function googleCalUrl(e: CaseEvent): string {
  const dates = e.allDay
    ? `${calStamp(e.start, true)}/${calStamp(e.start, true, 1)}`
    : `${calStamp(e.start, false)}/${calStamp(eventEnd(e), false)}`
  const p = new URLSearchParams({ action: "TEMPLATE", text: e.title, dates, details: eventDetails(e), location: e.location })
  return `https://calendar.google.com/calendar/render?${p.toString()}`
}

function outlookCalUrl(e: CaseEvent): string {
  const p = new URLSearchParams({
    path: "/calendar/action/compose",
    rru: "addevent",
    subject: e.title,
    startdt: new Date(e.start).toISOString(),
    enddt: new Date(eventEnd(e)).toISOString(),
    body: eventDetails(e),
    location: e.location,
    allday: String(e.allDay),
  })
  return `https://outlook.live.com/calendar/0/deeplink/compose?${p.toString()}`
}

function icsEscape(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n")
}

// Apple Calendar (and everything else) — downloads a standard .ics file
function downloadIcs(e: CaseEvent) {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Edwards Family Law Portal//EN",
    "BEGIN:VEVENT",
    `UID:${e.id}@edwards-law-portal`,
    `DTSTAMP:${calStamp(new Date().toISOString(), false)}`,
    e.allDay ? `DTSTART;VALUE=DATE:${calStamp(e.start, true)}` : `DTSTART:${calStamp(e.start, false)}`,
    e.allDay ? `DTEND;VALUE=DATE:${calStamp(e.start, true, 1)}` : `DTEND:${calStamp(eventEnd(e), false)}`,
    `SUMMARY:${icsEscape(e.title)}`,
    e.location ? `LOCATION:${icsEscape(e.location)}` : "",
    eventDetails(e) ? `DESCRIPTION:${icsEscape(eventDetails(e))}` : "",
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter(Boolean)
  const blob = new Blob([lines.join("\r\n")], { type: "text/calendar;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `${e.title.replace(/[^a-z0-9 ]/gi, "").trim() || "event"}.ics`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

function AddToCalendar({ e }: { e: CaseEvent }) {
  const cls = "text-[11px] font-medium px-2 py-0.5 rounded-full border border-gray-300 text-gray-600 hover:bg-gray-100 transition-colors"
  return (
    <span className="inline-flex items-center gap-1.5 flex-wrap">
      <span className="text-[11px] text-gray-400">Add to:</span>
      <a href={googleCalUrl(e)} target="_blank" rel="noopener noreferrer" className={cls}>Google</a>
      <a href={outlookCalUrl(e)} target="_blank" rel="noopener noreferrer" className={cls}>Outlook</a>
      <button type="button" onClick={() => downloadIcs(e)} className={cls}>Apple / .ics</button>
    </span>
  )
}

function AgendaRow({ e, isPast = false }: { e: CaseEvent; isPast?: boolean }) {
  return (
    <div className="flex items-start gap-4 px-5 py-3.5">
      <div className="w-40 shrink-0">
        <p className="text-sm font-semibold text-gray-900">{longDay(new Date(e.start))}</p>
        <p className="text-xs text-gray-500">{timeOf(e)}</p>
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-gray-900">{e.title}</p>
        {e.location && <p className="text-xs text-gray-600 mt-0.5"><LocationLink location={e.location} /></p>}
        {e.zoomLink && !isPast && (
          <p className="text-xs mt-0.5">
            <a href={e.zoomLink} target="_blank" rel="noopener noreferrer" className="underline break-all text-gray-500 hover:opacity-75">
              🎥 {e.zoomLink.replace(/^https?:\/\//i, "").split("?")[0]}
            </a>
          </p>
        )}
        {e.description && <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{e.description}</p>}
        {!isPast && <p className="mt-1.5"><AddToCalendar e={e} /></p>}
      </div>
      {e.zoomLink && !isPast && (
        <a href={e.zoomLink} target="_blank" rel="noopener noreferrer" className="shrink-0 text-sm font-semibold px-3.5 py-1.5 rounded-lg text-white hover:opacity-90" style={{ background: NAVY }}>
          🎥 Join Zoom
        </a>
      )}
    </div>
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
    else if (view === "twoweeks") d.setDate(d.getDate() + dir * 14)
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

  // ---- week / 2-week days ----
  const weekDays = useMemo(() => {
    const start = new Date(cursor)
    start.setDate(cursor.getDate() - cursor.getDay())
    const count = view === "twoweeks" ? 14 : 7
    return Array.from({ length: count }, (_, i) => {
      const d = new Date(start)
      d.setDate(start.getDate() + i)
      return d
    })
  }, [cursor, view])

  // ---- agenda: upcoming events (+ optional past history) ----
  const [showPast, setShowPast] = useState(false)
  const { agenda, past } = useMemo(() => {
    const now = new Date()
    now.setHours(0, 0, 0, 0)
    const upcoming = events.filter((e) => new Date(e.start) >= now)
    const history = events.filter((e) => new Date(e.start) < now).reverse() // most recent first
    return { agenda: upcoming, past: history }
  }, [events])

  const heading =
    view === "month"
      ? cursor.toLocaleDateString("en-US", { month: "long", year: "numeric" })
      : view === "week" || view === "twoweeks"
        ? `${weekDays[0].toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${weekDays[weekDays.length - 1].toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`
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
          {(["agenda", "month", "week", "twoweeks"] as View[]).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className="px-3.5 py-1.5"
              style={view === v ? { background: NAVY, color: "#fff", fontWeight: 600 } : { color: "#374151" }}
            >
              {VIEW_LABELS[v]}
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

      {/* week / 2-week view */}
      {(view === "week" || view === "twoweeks") && (
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
        <div>
          <div className="divide-y divide-gray-100">
            {agenda.length === 0 && <p className="text-sm text-gray-500 p-6">No upcoming events on your calendar.</p>}
            {agenda.map((e) => <AgendaRow key={e.id} e={e} />)}
          </div>
          {past.length > 0 && (
            <div className="border-t border-gray-200">
              <button
                type="button"
                onClick={() => setShowPast(!showPast)}
                className="w-full py-2.5 text-sm font-medium text-gray-500 hover:text-gray-800 hover:bg-gray-50 transition-colors"
              >
                {showPast ? "Hide past events ▴" : `Show ${past.length} past event${past.length === 1 ? "" : "s"} ▾`}
              </button>
              {showPast && (
                <div className="divide-y divide-gray-100 border-t border-gray-100 opacity-70">
                  {past.map((e) => <AgendaRow key={e.id} e={e} isPast />)}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
