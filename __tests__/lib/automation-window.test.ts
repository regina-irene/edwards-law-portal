jest.mock("@/lib/db", () => ({ sql: jest.fn() }))

import {
  isWithinWindow,
  normalizeWindow,
  describeWindow,
  localDayHour,
  DEFAULT_WINDOW,
} from "@/lib/automation-window"

/** A moment expressed in UTC, which is what the server's clock actually is. */
function utc(iso: string): Date {
  return new Date(iso)
}

describe("isWithinWindow", () => {
  // Regina asked for weekdays 8am to 4pm. These are the exact hours.
  it("is open on a weekday inside the hours", () => {
    // Wednesday 2026-09-02, 10am Eastern = 14:00 UTC (EDT, UTC-4)
    expect(isWithinWindow(DEFAULT_WINDOW, utc("2026-09-02T14:00:00Z"))).toBe(true)
  })

  it("opens exactly at 8am and not at 7:59", () => {
    expect(isWithinWindow(DEFAULT_WINDOW, utc("2026-09-02T12:00:00Z"))).toBe(true) // 8am
    expect(isWithinWindow(DEFAULT_WINDOW, utc("2026-09-02T11:30:00Z"))).toBe(false) // 7:30am
  })

  it("closes at 4pm, so 3:59 is in and 4:00 is out", () => {
    expect(isWithinWindow(DEFAULT_WINDOW, utc("2026-09-02T19:59:00Z"))).toBe(true) // 3:59pm
    expect(isWithinWindow(DEFAULT_WINDOW, utc("2026-09-02T20:00:00Z"))).toBe(false) // 4:00pm
  })

  it("is shut at the weekend", () => {
    // Saturday 2026-09-05 and Sunday 2026-09-06, both at 10am Eastern.
    expect(isWithinWindow(DEFAULT_WINDOW, utc("2026-09-05T14:00:00Z"))).toBe(false)
    expect(isWithinWindow(DEFAULT_WINDOW, utc("2026-09-06T14:00:00Z"))).toBe(false)
  })

  it("is shut late at night, which is the case that prompted all this", () => {
    // Saturday 11pm Eastern - a filing syncing then used to email immediately.
    expect(isWithinWindow(DEFAULT_WINDOW, utc("2026-09-06T03:00:00Z"))).toBe(false)
  })

  /**
   * The one that would silently break twice a year. Vercel runs in UTC, so
   * reading the server's own hour would be an hour out for half the year and
   * would have started sending at 7am every winter.
   */
  it("follows Eastern time across the daylight saving change", () => {
    // 12:30 UTC. In September (EDT, UTC-4) that is 8:30am - open.
    expect(isWithinWindow(DEFAULT_WINDOW, utc("2026-09-02T12:30:00Z"))).toBe(true)
    // The same 12:30 UTC in January (EST, UTC-5) is 7:30am - shut.
    expect(isWithinWindow(DEFAULT_WINDOW, utc("2027-01-06T12:30:00Z"))).toBe(false)
  })

  it("switched off, anything goes", () => {
    const off = { ...DEFAULT_WINDOW, enabled: false }
    expect(isWithinWindow(off, utc("2026-09-06T03:00:00Z"))).toBe(true)
  })
})

describe("localDayHour", () => {
  it("reads the firm's clock, not the server's", () => {
    // 01:00 UTC on Sunday is still 9pm on SATURDAY in Georgia.
    const { day, hour } = localDayHour(utc("2026-09-06T01:00:00Z"))
    expect(day).toBe(6) // Saturday
    expect(hour).toBe(21)
  })

  it("handles midnight without reporting hour 24", () => {
    const { hour } = localDayHour(utc("2026-09-02T04:00:00Z")) // midnight Eastern
    expect(hour).toBe(0)
  })
})

describe("normalizeWindow", () => {
  it("keeps a sensible window as it is", () => {
    const w = normalizeWindow({ enabled: true, startHour: 9, endHour: 17, days: [1, 3, 5] })
    expect(w).toEqual({ enabled: true, startHour: 9, endHour: 17, days: [1, 3, 5] })
  })

  // A window that ends before it starts would never open, and would look
  // exactly like the automations being broken.
  it("repairs an end time that is before the start", () => {
    const w = normalizeWindow({ enabled: true, startHour: 16, endHour: 8, days: [1] })
    expect(w.endHour).toBeGreaterThan(w.startHour)
  })

  it("throws away nonsense hours and days", () => {
    const w = normalizeWindow({ startHour: 99, endHour: -3, days: [1, 1, 9, 2] })
    expect(w.startHour).toBe(DEFAULT_WINDOW.startHour)
    expect(w.days).toEqual([1, 2])
  })

  it("falls back to the default for junk", () => {
    expect(normalizeWindow(null)).toEqual(DEFAULT_WINDOW)
    expect(normalizeWindow("nope")).toEqual(DEFAULT_WINDOW)
  })
})

describe("describeWindow", () => {
  it("says what Regina asked for in plain words", () => {
    expect(describeWindow(DEFAULT_WINDOW)).toBe("Weekdays, 8 am to 4 pm")
  })

  it("names odd days individually", () => {
    expect(describeWindow({ ...DEFAULT_WINDOW, days: [2, 4] })).toBe("Tue, Thu, 8 am to 4 pm")
  })

  it("says so when it is switched off", () => {
    expect(describeWindow({ ...DEFAULT_WINDOW, enabled: false })).toBe("Any time, any day")
  })

  it("uses noon and midnight rather than 12", () => {
    expect(describeWindow({ ...DEFAULT_WINDOW, startHour: 0, endHour: 12 })).toContain("midnight")
    expect(describeWindow({ ...DEFAULT_WINDOW, startHour: 0, endHour: 12 })).toContain("noon")
  })
})
