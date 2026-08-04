import { parsePleadingName } from "@/lib/pleadings"

describe("parsePleadingName", () => {
  it("keeps the leading date in the name but drops the trailing case tag", () => {
    expect(parsePleadingName("2019.08.19 Final Decree of Divorce (Lindholm).pdf")).toEqual({
      title: "2019.08.19 Final Decree of Divorce",
      filedOn: "2019-08-19",
      folder: null,
    })
  })

  it("pads single-digit months and days", () => {
    expect(parsePleadingName("2026.5.8 LOA RIE May 2026 (Leslie).pdf").filedOn).toBe("2026-05-08")
  })

  it("keeps a mid-name parenthetical note (only trailing tags are dropped)", () => {
    const r = parsePleadingName("2025.03.03 (not filed copy) H's Response to W's Motion to Compel.pdf")
    expect(r.title).toBe("2025.03.03 (not filed copy) H's Response to W's Motion to Compel")
    expect(r.filedOn).toBe("2025-03-03")
  })

  it("takes the date from the file name when the file sits in a subfolder", () => {
    const r = parsePleadingName(
      "FV matter/2026.05.04 FILED - FV Protective Order - granted, D taken into custody (Banks, Alecia).pdf"
    )
    expect(r.title).toBe("2026.05.04 FILED - FV Protective Order - granted, D taken into custody")
    expect(r.filedOn).toBe("2026-05-04")
    expect(r.folder).toBe("FV matter")
  })

  it("handles nested subfolders and backslash paths", () => {
    const nested = parsePleadingName("TPO/Orders/2026.04.09 FILED - Ex Parte Order.pdf")
    expect(nested.filedOn).toBe("2026-04-09")
    expect(nested.folder).toBe("Orders") // the folder the file actually sits in
    expect(parsePleadingName("TPO\\2026.04.09 FILED - Ex Parte Order.pdf").folder).toBe("TPO")
  })

  it("does not tag files sitting directly in the Pleadings folder", () => {
    expect(parsePleadingName("Pleadings/2026.04.15 FILED - Summons.pdf").folder).toBeNull()
  })

  it("handles names with no leading date", () => {
    expect(parsePleadingName("Standing Order.pdf")).toEqual({
      title: "Standing Order",
      filedOn: null,
      folder: null,
    })
  })
})
