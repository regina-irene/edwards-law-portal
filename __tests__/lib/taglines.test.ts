import { taglineFor } from "@/lib/taglines"

describe("taglineFor", () => {
  it("returns the tagline for a known client page", () => {
    expect(taglineFor("calendar")).toBe("Every date in your case, in one place")
  })
  it("returns the tagline for an admin page", () => {
    expect(taglineFor("admin:dashboard")).toBe("The whole practice, at a glance")
  })
  it("returns null for unknown/custom pages", () => {
    expect(taglineFor("custom-recipes")).toBeNull()
  })
})
