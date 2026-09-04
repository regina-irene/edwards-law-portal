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

  // A body with no tags in it is plain wording, and a stray bracket or
  // ampersand in it must not be able to break the email.
  it("escapes a plain-text body", () => {
    const out = renderEmail("Subject", "Cost < 500 & rising\n\n{{documents}}", {
      firstName: "X",
      clientName: "X",
      documents: DOCS,
      portalUrl: "https://example.com",
      noun: "filing",
    })
    expect(out.html).toContain("&lt; 500")
    expect(out.html).toContain("&amp;")
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

  // ---- rich bodies, written in the editor ---------------------------------

  const RICH =
    '<p>Dear {{first_name}},</p><p><strong>Important:</strong> ' +
    '<span style="color:#b91c1c">something new</span> is on your case.</p>' +
    "<p>{{documents}}</p><ul><li>Sign in: {{portal_link}}</li></ul>"

  function renderRich() {
    return renderEmail("Subject", RICH, {
      firstName: "Regina",
      clientName: "Edwards, Regina",
      documents: DOCS,
      portalUrl: "https://clients.edwardsfamilylaw.com",
      noun: "filing",
    })
  }

  it("keeps bold, colour and lists from the editor instead of escaping them", () => {
    const { html } = renderRich()
    expect(html).toContain("<strong>Important:</strong>")
    expect(html).toContain('style="color:#b91c1c"')
    expect(html).toContain("<li>")
    // The giveaway that it went down the rich path rather than the plain one.
    expect(html).not.toContain("&lt;strong&gt;")
  })

  it("still fills the placeholders inside rich wording", () => {
    const { html } = renderRich()
    expect(html).toContain("Dear Regina,")
    expect(html).toContain("2026.09.02 Notice of Hearing")
    expect(html).toContain(">Click here</a>")
    expect(html).not.toMatch(/\{\{|\}\}/)
  })

  it("still sends a readable plain-text version of a rich body", () => {
    const { text } = renderRich()
    expect(text).toContain("Dear Regina,")
    expect(text).toContain("Important:")
    // No tags, and the raw address is present for clients that refuse HTML.
    expect(text).not.toContain("<")
    expect(text).toContain(DOCS[0].link)
  })

  it("strips scripts and event handlers out of a rich body", () => {
    const out = renderEmail(
      "S",
      '<p onclick="steal()">Hello</p><script>alert(1)</script><p>Bye</p>',
      {
        firstName: "A",
        clientName: "A",
        documents: DOCS,
        portalUrl: "https://example.com",
        noun: "filing",
      }
    )
    expect(out.html).not.toContain("<script")
    expect(out.html).not.toContain("onclick")
    expect(out.html).toContain("Hello")
    expect(out.html).toContain("Bye")
  })

  // The marker used while escaping must not be something anybody could type.
  it("does not eat the word DOCS if it appears in the wording", () => {
    const out = renderEmail("S", "<p>Please review the DOCS attached.</p><p>{{documents}}</p>", {
      firstName: "A",
      clientName: "A",
      documents: DOCS,
      portalUrl: "https://example.com",
      noun: "filing",
    })
    expect(out.html).toContain("Please review the DOCS attached.")
    expect(out.html).toContain("2026.09.02 Notice of Hearing")
  })

  // The firm logo is inserted as a public URL on purpose; a private one would
  // arrive as a broken box in the client's inbox.
  it("keeps an image in the wording", () => {
    const out = renderEmail(
      "S",
      '<p><img src="https://clients.edwardsfamilylaw.com/efl-logo-email.png" width="120" /></p><p>Hello</p>',
      {
        firstName: "A",
        clientName: "A",
        documents: DOCS,
        portalUrl: "https://example.com",
        noun: "filing",
      }
    )
    expect(out.html).toContain("efl-logo-email.png")
    expect(out.html).toContain('width="120"')
  })
})
