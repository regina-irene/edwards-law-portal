import { getScheme, SCHEMES, SCHEME_KEYS, DEFAULT_SCHEME_KEY } from "@/lib/color-schemes"

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
