import {
  getScheme,
  SCHEMES,
  SCHEME_KEYS,
  DEFAULT_SCHEME_KEY,
  applyGradient,
  resolveScheme,
  isDarkSidebar,
} from "@/lib/color-schemes"

describe("color schemes", () => {
  it("has exactly the 8 approved schemes", () => {
    expect(SCHEME_KEYS.sort()).toEqual(
      ["burgundy", "football", "halloween", "navy", "plum", "sage", "slate", "winter"].sort()
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
    for (const key of ["halloween", "winter", "football"]) {
      const s = SCHEMES[key]
      expect(s.seasonal).toBe(true)
      expect(s.stripe).toBeTruthy()
      expect(s.watermark.length).toBeGreaterThanOrEqual(4)
      expect(s.titleEmoji).toBeTruthy()
    }
    for (const key of ["navy", "sage", "burgundy", "slate", "plum"]) {
      expect(SCHEMES[key].seasonal).toBe(false)
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

  it("flags navy as the only light sidebar", () => {
    expect(isDarkSidebar(SCHEMES.navy)).toBe(false)
    for (const key of SCHEME_KEYS.filter((k) => k !== "navy")) {
      expect(isDarkSidebar(SCHEMES[key])).toBe(true)
    }
  })
})
