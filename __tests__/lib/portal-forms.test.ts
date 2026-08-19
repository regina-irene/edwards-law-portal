import { normalizeDefinition, slugify, countFields } from "@/lib/portal-forms"

describe("slugify", () => {
  it("makes a URL-safe key from a label", () => {
    expect(slugify("Client Information Worksheet")).toBe("client-information-worksheet")
  })
  it("falls back when there's nothing usable", () => {
    expect(slugify("!!!", "field-1")).toBe("field-1")
  })
})

describe("normalizeDefinition", () => {
  it("keeps an existing field key exactly - answers are filed under it", () => {
    const def = normalizeDefinition("intake", "Intake", null, [
      { title: "About you", fields: [{ label: "Full legal name", fieldKey: "client_full_name", type: "text" }] },
    ])
    // Underscores must survive: FileFlow keys look like this, and a rewrite
    // would orphan every answer already given.
    expect(def.sections[0].fields[0].fieldKey).toBe("client_full_name")
  })

  it("invents a key from the label when there isn't one", () => {
    const def = normalizeDefinition("intake", "Intake", null, [
      { title: "About you", fields: [{ label: "Date of birth", type: "date" }] },
    ])
    expect(def.sections[0].fields[0].fieldKey).toBe("date-of-birth")
  })

  it("never repeats a key within a form", () => {
    const def = normalizeDefinition("intake", "Intake", null, [
      { title: "One", fields: [{ label: "Name", type: "text" }, { label: "Name", type: "text" }] },
    ])
    const keys = def.sections[0].fields.map((f) => f.fieldKey)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it("falls back to a text box for a type the filler can't render", () => {
    const def = normalizeDefinition("intake", "Intake", null, [
      { title: "One", fields: [{ label: "Signature", type: "signature-pad" }] },
    ])
    expect(def.sections[0].fields[0].type).toBe("text")
  })

  it("only keeps options on choice fields", () => {
    const def = normalizeDefinition("intake", "Intake", null, [
      {
        title: "One",
        fields: [
          { label: "Employed?", type: "radio", options: [{ label: "Yes" }, { label: "No" }] },
          { label: "Notes", type: "textarea", options: [{ label: "stray" }] },
        ],
      },
    ])
    expect(def.sections[0].fields[0].options).toEqual([
      { value: "yes", label: "Yes" },
      { value: "no", label: "No" },
    ])
    expect(def.sections[0].fields[1].options).toBeNull()
  })

  it("drops sections that ended up with no questions", () => {
    const def = normalizeDefinition("intake", "Intake", null, [
      { title: "Empty", fields: [] },
      { title: "Real", fields: [{ label: "Name", type: "text" }] },
    ])
    expect(def.sections).toHaveLength(1)
    expect(countFields(def)).toBe(1)
  })
})
