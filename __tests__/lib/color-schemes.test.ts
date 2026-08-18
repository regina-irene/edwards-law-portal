import {
  getScheme,
  SCHEMES,
  SCHEME_KEYS,
  DEFAULT_SCHEME_KEY,
  applyGradient,
  resolveScheme,
  isDarkSidebar,
  isInSeason,
  getSeasonalSuggestions,
  EVERYDAY_KEYS,
  SEASONAL_KEYS,
} from "@/lib/color-schemes"

describe("color schemes", () => {
  it("has exactly the 19 approved schemes", () => {
    expect(SCHEME_KEYS.sort()).toEqual(
      [
        "burgundy", "football", "halloween", "navy", "plum", "sage", "slate", "winter",
        // pastel + sunset additions, 2026-08-18
        "blush", "seafoam", "sunset",
        // holiday additions, 2026-08-18
        "valentines", "stpatricks", "spring", "july4", "thanksgiving",
        "christmas", "hanukkah", "newyear",
      ].sort()
    )
  })

  it("falls back to navy for unknown, legacy, null and undefined keys", () => {
    expect(getScheme("classic").key).toBe("navy")
    expect(getScheme("nfl-falcons").key).toBe("navy")
    expect(getScheme(null).key).toBe("navy")
    expect(getScheme(undefined).key).toBe("navy")
  })

  it("returns the requested scheme for valid keys", () => {
    for (const key of SCHEME_KEYS) expect(getScheme(key).key).toBe(key)
  })

  it("navy matches today's portal exactly", () => {
    const navy = SCHEMES[DEFAULT_SCHEME_KEY]
    expect(navy.pageBg).toBe("#FBF8F3")
    expect(navy.sidebarBg).toBe("#F5EEE3")
    expect(navy.accent).toBe("#1B2D45")
    expect(navy.seasonal).toBe(false)
    expect(navy.stripe).toBeNull()
    expect(navy.watermark).toEqual([])
  })

  it("seasonal schemes have decorations, core schemes have none", () => {
    for (const key of [
      "halloween", "winter", "football", "valentines", "stpatricks", "spring",
      "july4", "thanksgiving", "christmas", "hanukkah", "newyear",
    ]) {
      const s = SCHEMES[key]
      expect(s.seasonal).toBe(true)
      expect(s.stripe).toBeTruthy()
      expect(s.watermark.length).toBeGreaterThanOrEqual(4)
      expect(s.titleEmoji).toBeTruthy()
    }
    for (const key of ["navy", "sage", "burgundy", "slate", "plum", "blush", "seafoam", "sunset"]) {
      expect(SCHEMES[key].seasonal).toBe(false)
      expect(SCHEMES[key].stripe).toBeNull()
      expect(SCHEMES[key].titleEmoji).toBeNull()
    }
  })
})

describe("gradient mode", () => {
  it("gives every scheme a page and sidebar gradient", () => {
    for (const key of SCHEME_KEYS) {
      const s = SCHEMES[key]
      expect(s.pageBgGradient).toMatch(/gradient\(/)
      expect(s.sidebarBgGradient).toMatch(/gradient\(/)
    }
  })

  it("swaps only the two background surfaces", () => {
    for (const key of SCHEME_KEYS) {
      const flat = SCHEMES[key]
      const grad = applyGradient(flat, true)
      expect(grad.pageBg).toBe(flat.pageBgGradient)
      expect(grad.sidebarBg).toBe(flat.sidebarBgGradient)
      // everything that carries contrast is untouched
      expect(grad.accent).toBe(flat.accent)
      expect(grad.heading).toBe(flat.heading)
      expect(grad.navInk).toBe(flat.navInk)
      expect(grad.navActiveBg).toBe(flat.navActiveBg)
      expect(grad.navActiveInk).toBe(flat.navActiveInk)
      expect(grad.metaBorder).toBe(flat.metaBorder)
      expect(grad.stripe).toBe(flat.stripe)
      expect(grad.titleEmoji).toBe(flat.titleEmoji)
    }
  })

  it("leaves the scheme untouched when gradient is off, null or undefined", () => {
    for (const off of [false, null, undefined]) {
      const s = applyGradient(SCHEMES.navy, off)
      expect(s.pageBg).toBe("#FBF8F3")
      expect(s.sidebarBg).toBe("#F5EEE3")
    }
  })

  it("resolveScheme combines lookup and gradient, falling back to navy", () => {
    expect(resolveScheme("plum", false).pageBg).toBe(SCHEMES.plum.pageBg)
    expect(resolveScheme("plum", true).pageBg).toBe(SCHEMES.plum.pageBgGradient)
    expect(resolveScheme("classic", true).key).toBe("navy")
    expect(resolveScheme(null, false).pageBg).toBe("#FBF8F3")
  })

  it("groups every scheme into exactly one of everyday or seasonal", () => {
    expect([...EVERYDAY_KEYS, ...SEASONAL_KEYS].sort()).toEqual([...SCHEME_KEYS].sort())
    expect(EVERYDAY_KEYS.filter((k) => SEASONAL_KEYS.includes(k))).toEqual([])
  })

  it("flags navy as the only light sidebar", () => {
    expect(isDarkSidebar(SCHEMES.navy)).toBe(false)
    for (const key of SCHEME_KEYS.filter((k) => k !== "navy")) {
      expect(isDarkSidebar(SCHEMES[key])).toBe(true)
    }
  })
})

describe("seasonal suggestions", () => {
  const on = (m: number, d: number) => new Date(2026, m - 1, d)

  it("only seasonal schemes carry a season window", () => {
    for (const key of SEASONAL_KEYS) expect(SCHEMES[key].season).toBeDefined()
    for (const key of EVERYDAY_KEYS) expect(SCHEMES[key].season).toBeUndefined()
  })

  it("matches each holiday on its own date", () => {
    const cases: [number, number, string][] = [
      [2, 12, "valentines"],
      [3, 15, "stpatricks"],
      [4, 5, "spring"],
      [7, 4, "july4"],
      [9, 12, "football"],
      [10, 31, "halloween"],
      [11, 26, "thanksgiving"],
      [12, 25, "christmas"],
      [1, 20, "winter"],
    ]
    for (const [m, d, key] of cases) {
      expect(getSeasonalSuggestions(on(m, d)).map((s) => s.key)).toContain(key)
    }
  })

  it("handles the window that wraps the year end", () => {
    expect(isInSeason(SCHEMES.newyear, on(12, 31))).toBe(true)
    expect(isInSeason(SCHEMES.newyear, on(1, 3))).toBe(true)
    expect(isInSeason(SCHEMES.newyear, on(6, 1))).toBe(false)
  })

  it("returns both December looks in December", () => {
    const keys = getSeasonalSuggestions(on(12, 10)).map((s) => s.key)
    expect(keys).toEqual(expect.arrayContaining(["christmas", "hanukkah"]))
  })

  it("suggests nothing in the quiet stretches", () => {
    expect(getSeasonalSuggestions(on(5, 20))).toEqual([])
    expect(getSeasonalSuggestions(on(8, 10))).toEqual([])
  })
})
