import { parsePleadingName } from "@/lib/pleadings"

describe("parsePleadingName", () => {
  it("keeps the full name (incl. leading date and case tag) and parses the filing date", () => {
    expect(parsePleadingName("2019.08.19 Final Decree of Divorce (Lindholm).pdf")).toEqual({
      title: "2019.08.19 Final Decree of Divorce (Lindholm)",
      filedOn: "2019-08-19",
    })
  })

  it("pads single-digit months and days", () => {
    expect(parsePleadingName("2026.5.8 LOA RIE May 2026 (Leslie).pdf").filedOn).toBe("2026-05-08")
  })

  it("strips only the file extension", () => {
    const r = parsePleadingName("2025.03.03 (not filed copy) H's Response to W's Motion to Compel.pdf")
    expect(r.title).toBe("2025.03.03 (not filed copy) H's Response to W's Motion to Compel")
    expect(r.filedOn).toBe("2025-03-03")
  })

  it("handles names with no leading date", () => {
    expect(parsePleadingName("Standing Order.pdf")).toEqual({ title: "Standing Order", filedOn: null })
  })
})
