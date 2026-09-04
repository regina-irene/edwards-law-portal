import { normalizeBaseId, clientFirstName } from "@/lib/client-ids"

describe("normalizeBaseId", () => {
  it("leaves a plain base id alone", () => {
    expect(normalizeBaseId("appW8I3VgLC83iZNW")).toBe("appW8I3VgLC83iZNW")
  })

  // The real Edwards, Regina value (2026-09-04). This broke her Correspondence
  // page and made the new-document automation skip her without a word.
  it("drops a table id pasted onto the end", () => {
    expect(normalizeBaseId("appPtZHlmuCllLk4i/tblivNbyTFXiNPzkx")).toBe("appPtZHlmuCllLk4i")
  })

  it("pulls the base id out of a full Airtable URL", () => {
    expect(
      normalizeBaseId("https://airtable.com/appPtZHlmuCllLk4i/tblivNbyTFXiNPzkx/viwABC")
    ).toBe("appPtZHlmuCllLk4i")
  })

  it("trims stray whitespace", () => {
    expect(normalizeBaseId("  appW8I3VgLC83iZNW  ")).toBe("appW8I3VgLC83iZNW")
  })

  it("is empty for empty or missing values", () => {
    expect(normalizeBaseId("")).toBe("")
    expect(normalizeBaseId(undefined)).toBe("")
    expect(normalizeBaseId(null)).toBe("")
  })

  // Returned as-is rather than blanked: a value we don't recognise is more
  // useful in an error message than an empty string.
  it("hands back anything unrecognisable unchanged", () => {
    expect(normalizeBaseId("not-a-base")).toBe("not-a-base")
  })
})

describe("clientFirstName", () => {
  it("reads the firm's usual pipe format", () => {
    expect(clientFirstName("Gichana | Culix")).toBe("Culix")
  })

  it("reads a comma too", () => {
    expect(clientFirstName("Edwards, Regina")).toBe("Regina")
  })

  it("is empty when there is only one part, so the greeting falls back", () => {
    expect(clientFirstName("Edwards")).toBe("")
    expect(clientFirstName("")).toBe("")
  })
})
