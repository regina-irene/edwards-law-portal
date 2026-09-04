import { renderEmail, DEFAULT_SUBJECT, DEFAULT_BODY } from "@/lib/automation-email"

const DOCS = [
  {
    title: "2026.09.02 Notice of Hearing",
    link: "https://drive.google.com/file/d/1aVeryLongDriveIdThatWouldWrapInPlainText/view?usp=sharing",
    date: "2026-09-02",
  },
]

function render(over: Partial<Parameters<typeof renderEmail>[2]> = {}) {
  return renderEmail(DEFAULT_SUBJECT, DEFAULT_BODY, {
    firstName: "Regina",
    clientName: "Edwards, Regina",
    documents: DOCS,
    portalUrl: "https://clients.edwardsfamilylaw.com",
    noun: "filing",
    ...over,
  })
}

describe("renderEmail", () => {
  it("greets the client by name", () => {
    expect(render().text).toContain("Dear Regina,")
  })

  it("falls back to a greeting that still reads properly with no first name", () => {
    const out = render({ firstName: "" })
    expect(out.text).toContain("Dear there,")
    expect(out.text).not.toContain("{{first_name}}")
  })

  // The whole point of the HTML version: a Drive URL is far too long to sit in
  // a plain-text line, and mail clients wrap it and break the link.
  it("embeds the document link behind short 'Click here' text", () => {
    const { html } = render()
    expect(html).toContain(">Click here</a>")
    expect(html).toContain(`href="${DOCS[0].link}"`)
    expect(html).toContain("2026.09.02 Notice of Hearing")
  })

  it("still puts the raw address in the plain text version, for clients that refuse HTML", () => {
    expect(render().text).toContain(DOCS[0].link)
  })

  it("links the portal too", () => {
    expect(render().html).toContain('href="https://clients.edwardsfamilylaw.com"')
  })

  it("agrees singular and plural", () => {
    expect(render().subject).toBe("1 new filing on your case")
    expect(render().text).toContain("1 new filing has been added")

    const many = render({ documents: [...DOCS, { ...DOCS[0], title: "Second" }] })
    expect(many.subject).toBe("2 new filings on your case")
    expect(many.text).toContain("2 new filings have been added")
  })

  it("uses the word the rule supplies", () => {
    expect(render({ noun: "letter" }).subject).toBe("1 new letter on your case")
  })

  // Her wording is text, not markup. A stray angle bracket must not be able to
  // break the email, and nobody should be able to smuggle markup through it.
  it("escapes anything HTML-ish in the wording", () => {
    const out = renderEmail("Subject", "Hi <b>there</b> & welcome\n\n{{documents}}", {
      firstName: "X",
      clientName: "X",
      documents: DOCS,
      portalUrl: "https://example.com",
      noun: "filing",
    })
    expect(out.html).toContain("&lt;b&gt;there&lt;/b&gt;")
    expect(out.html).toContain("&amp;")
    expect(out.html).not.toContain("<b>there</b>")
  })

  it("escapes a document title too", () => {
    const out = render({ documents: [{ ...DOCS[0], title: "<script>x</script>" }] })
    expect(out.html).not.toContain("<script>")
    expect(out.html).toContain("&lt;script&gt;")
  })

  // An email we send on the firm's behalf should never carry a javascript: link
  // just because a URL column held one.
  it("refuses to link anything that is not http or https", () => {
    const out = render({
      documents: [{ title: "Odd", link: "javascript:alert(1)", date: null }],
    })
    expect(out.html).not.toContain("javascript:")
    // One "Click here" remains: the portal link, which we control. The
    // document itself is shown as plain text with no anchor at all.
    expect(out.html.match(/>Click here<\/a>/g)).toHaveLength(1)
    expect(out.html).toContain("Odd")
  })

  it("leaves no placeholders behind", () => {
    const out = render()
    expect(out.html).not.toMatch(/\{\{|\}\}/)
    expect(out.text).not.toMatch(/\{\{|\}\}/)
    expect(out.subject).not.toMatch(/\{\{|\}\}/)
  })

  it("never returns an empty subject, even if the template is blank", () => {
    const out = renderEmail("   ", DEFAULT_BODY, {
      firstName: "A",
      clientName: "A",
      documents: DOCS,
      portalUrl: "https://example.com",
      noun: "filing",
    })
    expect(out.subject.trim()).not.toBe("")
  })
})
