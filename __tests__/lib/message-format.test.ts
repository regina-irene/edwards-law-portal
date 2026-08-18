import {
  isHtmlBody,
  plainToHtml,
  bodyToHtml,
  bodyToPlainText,
  isEmptyRich,
} from "@/lib/message-format"

describe("detecting rich vs plain bodies", () => {
  it("treats real markup as HTML", () => {
    expect(isHtmlBody("<p>Hello</p>")).toBe(true)
    expect(isHtmlBody("line one<br>line two")).toBe(true)
    expect(isHtmlBody("<ul><li>a</li></ul>")).toBe(true)
    expect(isHtmlBody('<a href="https://x.com">link</a>')).toBe(true)
  })

  it("does not mistake ordinary typing for HTML", () => {
    expect(isHtmlBody("Plain message")).toBe(false)
    expect(isHtmlBody("I <3 this")).toBe(false)
    expect(isHtmlBody("a < b and c > d")).toBe(false)
    expect(isHtmlBody("Call me <after 5pm>")).toBe(false)
    expect(isHtmlBody("")).toBe(false)
  })
})

describe("plain to HTML", () => {
  it("escapes and turns newlines into line breaks", () => {
    expect(plainToHtml("one\ntwo")).toBe("one<br>two")
    expect(plainToHtml("a & b")).toBe("a &amp; b")
    expect(plainToHtml("<script>")).toBe("&lt;script&gt;")
  })

  it("passes rich bodies through untouched", () => {
    const html = "<p><b>Hi</b></p>"
    expect(bodyToHtml(html)).toBe(html)
  })

  it("converts plain bodies for the clipboard", () => {
    expect(bodyToHtml("one\ntwo")).toBe("one<br>two")
  })
})

describe("HTML to plain text", () => {
  it("leaves plain bodies alone", () => {
    expect(bodyToPlainText("just text\nwith a break")).toBe("just text\nwith a break")
  })

  it("keeps the shape of a rich message", () => {
    expect(bodyToPlainText("<p>One</p><p>Two</p>")).toBe("One\nTwo")
    expect(bodyToPlainText("a<br>b")).toBe("a\nb")
  })

  it("bullets list items so texts still read properly", () => {
    expect(bodyToPlainText("<ul><li>first</li><li>second</li></ul>")).toContain("• first")
    expect(bodyToPlainText("<ul><li>first</li><li>second</li></ul>")).toContain("• second")
  })

  it("strips tags and decodes entities", () => {
    expect(bodyToPlainText("<p><b>Bold</b> and <i>italic</i></p>")).toBe("Bold and italic")
    expect(bodyToPlainText("<p>a &amp; b</p>")).toBe("a & b")
    expect(bodyToPlainText("<p>Tom&#39;s file</p>")).toBe("Tom's file")
  })

  it("collapses the blank lines tag stripping leaves behind", () => {
    expect(bodyToPlainText("<p>a</p><p></p><p></p><p>b</p>")).toBe("a\n\nb")
  })
})

describe("empty rich composer", () => {
  it("recognises the shapes contenteditable leaves behind", () => {
    for (const empty of ["", "<p></p>", "<br>", "<p><br></p>", "<div>&nbsp;</div>", "   "]) {
      expect(isEmptyRich(empty)).toBe(true)
    }
  })

  it("is not fooled by real content", () => {
    expect(isEmptyRich("<p>hi</p>")).toBe(false)
    expect(isEmptyRich('<p><img src="/x.png"></p>')).toBe(false)
  })
})
