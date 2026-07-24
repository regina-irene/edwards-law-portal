import { plainTextOf, snippetOf } from "@/lib/notes"

describe("plainTextOf", () => {
  it("strips tags, decodes entities, collapses whitespace", () => {
    expect(plainTextOf("<p>Called <b>client</b> re:&nbsp;mediation &amp; costs</p>\n<p>Follow up</p>"))
      .toBe("Called client re: mediation & costs Follow up")
  })
  it("returns empty string for empty/tag-only html", () => {
    expect(plainTextOf("<p><br></p>")).toBe("")
  })
})

describe("snippetOf", () => {
  it("passes short text through untruncated", () => {
    expect(snippetOf("<p>Short note</p>")).toBe("Short note")
  })
  it("truncates at the limit and appends an ellipsis", () => {
    const long = "<p>" + "word ".repeat(60) + "</p>"
    const s = snippetOf(long)
    expect(s.length).toBeLessThanOrEqual(141) // 140 + ellipsis char
    expect(s.endsWith("…")).toBe(true)
  })
})
