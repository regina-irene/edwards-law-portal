import { decodeEntities, unwrapGoogleRedirect, cleanDescription } from "@/lib/calendar"

// real-world mess from a Google-Calendar-synced Zoom invite
const GOOGLE_WRAPPED =
  "https://www.google.com/url?q=https://us02web.zoom.us/j/86423007927?jst%3D2&amp;sa=D&amp;source=calendar&amp;usd=2&amp;usg=AOvVaw32"

describe("calendar cleanup", () => {
  it("decodes HTML entities", () => {
    expect(decodeEntities("a &amp; b &quot;c&quot;")).toBe('a & b "c"')
  })

  it("unwraps Google redirect URLs to the real Zoom link", () => {
    const unwrapped = unwrapGoogleRedirect(decodeEntities(GOOGLE_WRAPPED))
    expect(unwrapped).toBe("https://us02web.zoom.us/j/86423007927?jst=2")
  })

  it("leaves normal URLs alone", () => {
    expect(unwrapGoogleRedirect("https://us02web.zoom.us/j/123")).toBe("https://us02web.zoom.us/j/123")
  })

  it("strips zoom boilerplate, dividers, tags, and bare URLs from descriptions", () => {
    const raw =
      'Prep notes for hearing. ────────── Regina Edwards, Attorney is inviting you to a scheduled Zoom meeting. Join Zoom Meeting <a href="https://www.google.com/url?q=https://us02web.zoom.us/j/864?jst%3D2">link</a> Meeting chat'
    expect(cleanDescription(raw)).toBe("Prep notes for hearing.")
  })

  it("returns empty when the description is only boilerplate", () => {
    const raw =
      "Regina Edwards, Attorney is inviting you to a scheduled Zoom meeting. Join Zoom Meeting https://us02web.zoom.us/j/1"
    expect(cleanDescription(raw)).toBe("")
  })
})
