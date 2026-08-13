import { driveFolderName, safeFolderName } from "@/lib/client-uploads"

describe("driveFolderName", () => {
  it("turns an Airtable 'Last | First' name into a folder name", () => {
    expect(driveFolderName("Grey | Cleon")).toBe("Grey, Cleon")
  })
  it("spells the first name out (unlike the admin list's initial)", () => {
    expect(driveFolderName("Boatman | Leslie")).toBe("Boatman, Leslie")
  })
  it("falls back to whichever part exists", () => {
    expect(driveFolderName("Grey")).toBe("Grey")
    expect(driveFolderName("")).toBe("")
  })
})

describe("safeFolderName", () => {
  it("replaces slashes so Drive doesn't read them as nested folders", () => {
    expect(safeFolderName("Smith/Jones | Pat")).toBe("Smith-Jones | Pat")
  })
  it("collapses whitespace and trims", () => {
    expect(safeFolderName("  Grey,   Cleon  ")).toBe("Grey, Cleon")
  })
})
