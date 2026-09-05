// lib/automation-window.ts - the hours when automatic email may leave the
// building (2026-09-04).
//
// WHY. The automations run hourly, which means that without this a filing that
// synced at 11pm on a Saturday emailed the client at 11pm on a Saturday. That
// reads as a firm that works around the clock, invites a reply at midnight, and
// for a family law client in a difficult week an unexpected email at that hour
// lands harder than the same words on Monday morning.
//
// NOTHING IS EVER DROPPED. Outside the window the scan does not run at all - it
// does not read the boards, does not mark anything as seen, and does not send.
// The documents therefore stay new, and the first run after the window opens
// picks them up and sends them then. That is the whole reason the check is at
// the top of the run rather than at the point of sending: a check at the send
// point would have already marked things as accounted for, and the client would
// never hear about them.
import { sql } from "@/lib/db"

/** The firm is in Georgia; the rest of the portal already assumes this. */
export const TIME_ZONE = "America/New_York"

export interface SendWindow {
  /** Off means send whenever something is found, day or night. */
  enabled: boolean
  /** Hour of day, 0-23, when sending may start. 8 = 8am. */
  startHour: number
  /** Hour of day, 0-23, after which sending stops. 16 = nothing sent from 4pm. */
  endHour: number
  /** Days sending is allowed. 0 is Sunday, 6 is Saturday. */
  days: number[]
}

export const DEFAULT_WINDOW: SendWindow = {
  enabled: true,
  startHour: 8,
  endHour: 16,
  days: [1, 2, 3, 4, 5],
}

const KEY = "automation_send_window"

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]

/** 12-hour clock, the way anybody would say it out loud. */
export function hourLabel(h: number): string {
  const hour = ((h % 24) + 24) % 24
  if (hour === 0) return "midnight"
  if (hour === 12) return "noon"
  return hour < 12 ? `${hour} am` : `${hour - 12} pm`
}

/** "Weekdays, 8 am to 4 pm" - for the page and for the run report. */
export function describeWindow(w: SendWindow): string {
  if (!w.enabled) return "Any time, any day"
  const d = [...w.days].sort()
  const weekdays = d.length === 5 && d.every((x, i) => x === i + 1)
  const everyDay = d.length === 7
  const label = everyDay
    ? "Every day"
    : weekdays
      ? "Weekdays"
      : d.length === 0
        ? "No days"
        : d.map((x) => DAY_NAMES[x].slice(0, 3)).join(", ")
  return `${label}, ${hourLabel(w.startHour)} to ${hourLabel(w.endHour)}`
}

/**
 * The day and hour it is right now IN THE FIRM'S TIME ZONE.
 *
 * Read through Intl rather than the server's own clock: Vercel runs in UTC, so
 * `new Date().getHours()` there is five hours ahead of Lawrenceville for half
 * the year and four for the other half. Doing it this way also means the
 * daylight saving change needs no thought at all.
 */
export function localDayHour(now: Date = new Date()): { day: number; hour: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    weekday: "short",
    hour: "numeric",
    hour12: false,
  }).formatToParts(now)

  const weekday = parts.find((p) => p.type === "weekday")?.value ?? "Sun"
  const hourRaw = parts.find((p) => p.type === "hour")?.value ?? "0"
  const shortNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
  // hour12:false can render midnight as "24" in some runtimes.
  const hour = Number(hourRaw) % 24
  return { day: Math.max(0, shortNames.indexOf(weekday)), hour }
}

/** May an automatic email go out right now? */
export function isWithinWindow(w: SendWindow, now: Date = new Date()): boolean {
  if (!w.enabled) return true
  const { day, hour } = localDayHour(now)
  if (!w.days.includes(day)) return false
  // endHour is exclusive: 16 means the last email can leave at 3:59pm, which is
  // what "between 8 and 4" means to a person.
  return hour >= w.startHour && hour < w.endHour
}

function clampHour(v: unknown, fallback: number): number {
  const n = Number(v)
  return Number.isInteger(n) && n >= 0 && n <= 23 ? n : fallback
}

export function normalizeWindow(raw: unknown): SendWindow {
  const o = (raw ?? {}) as Partial<SendWindow>
  const days = Array.isArray(o.days)
    ? [...new Set(o.days.map(Number).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))].sort()
    : DEFAULT_WINDOW.days
  const startHour = clampHour(o.startHour, DEFAULT_WINDOW.startHour)
  let endHour = clampHour(o.endHour, DEFAULT_WINDOW.endHour)
  // A window that ends before it starts would never be open, and would look
  // like the automations were simply broken. Treat it as a typo.
  if (endHour <= startHour) endHour = Math.min(23, startHour + 1)
  return {
    enabled: typeof o.enabled === "boolean" ? o.enabled : DEFAULT_WINDOW.enabled,
    startHour,
    endHour,
    days,
  }
}

export async function getSendWindow(): Promise<SendWindow> {
  try {
    const r = await sql`SELECT value FROM app_settings WHERE key = ${KEY}`
    if (!r.rows[0]) return DEFAULT_WINDOW
    return normalizeWindow(JSON.parse(String(r.rows[0].value)))
  } catch {
    // A window we cannot read falls back to the sensible one rather than to
    // "send at any hour" - the safer direction for something that emails
    // clients on its own.
    return DEFAULT_WINDOW
  }
}

export async function setSendWindow(w: SendWindow): Promise<void> {
  const clean = normalizeWindow(w)
  await sql`
    INSERT INTO app_settings (key, value, updated_at)
    VALUES (${KEY}, ${JSON.stringify(clean)}, now())
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()
  `
}
