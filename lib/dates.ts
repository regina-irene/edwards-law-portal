// lib/dates.ts - one place for how dates read across the portal (2026-08-18).
//
// Everything is pinned to America/New_York. A client checking their case from
// a different timezone should see the same date the firm sees; a court date
// shifting by a day because someone travelled is not acceptable.
//
// "Today" and "Yesterday" scan faster, but on their own they lose the record:
// a log entry that just says "Today" is worthless a week later, and worse when
// printed. So the relative word is always paired with the real date and time.

const TZ = "America/New_York"

/** "August 18, 2026" */
export function longDate(d: string | Date): string {
  return new Date(d).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: TZ,
  })
}

/** "3:42 PM" */
export function timeOfDay(d: string | Date): string {
  return new Date(d).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: TZ,
  })
}

/** "August 18, 2026 at 3:42 PM" - the unambiguous version, safe to print. */
export function fullStamp(d: string | Date): string {
  return `${longDate(d)} at ${timeOfDay(d)}`
}

/** "Today" / "Yesterday" / "August 12, 2026". */
export function relativeDay(d: string | Date): string {
  const day = longDate(d)
  if (day === longDate(new Date())) return "Today"
  if (day === longDate(new Date(Date.now() - 86_400_000))) return "Yesterday"
  return day
}

/**
 * The heading for a day's group of entries. Today and Yesterday keep their
 * shorthand but carry the actual date with them, so the log still reads
 * correctly tomorrow, next month, and on paper.
 *
 * → "Today · August 18, 2026"   → "August 12, 2026"
 */
export function dayHeadingWithDate(d: string | Date): string {
  const day = longDate(d)
  const rel = relativeDay(d)
  return rel === day ? day : `${rel} · ${day}`
}
