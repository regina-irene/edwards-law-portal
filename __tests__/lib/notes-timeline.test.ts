import { mergeTimeline, clientProseName, clientActor, type TimelineEvent } from "@/lib/notes-timeline"
import type { ClientNote } from "@/lib/notes"

const note = (id: string, at: string): ClientNote => ({ id, body: "<p>n</p>", created_at: at, updated_at: null, author_name: "Regina", author_email: "regina@x.com" })
const event = (id: string, at: string): TimelineEvent => ({ id, kind: "chat", at, sender: "client", smsStatus: null, detail: "sent a message" })

describe("mergeTimeline", () => {
  it("interleaves notes and events newest-first", () => {
    const items = mergeTimeline(
      [note("n1", "2026-07-20T10:00:00Z"), note("n2", "2026-07-01T10:00:00Z")],
      [event("e1", "2026-07-10T10:00:00Z")]
    )
    expect(items.map((i) => i.type)).toEqual(["note", "event", "note"])
  })
  it("breaks timestamp ties deterministically (id descending)", () => {
    // Comparator sorts descending by id: idb.localeCompare(ida). "n1" > "e9"
    // lexicographically, so the note sorts before the event.
    const items = mergeTimeline([note("n1", "2026-07-10T10:00:00Z")], [event("e9", "2026-07-10T10:00:00Z")])
    expect(items.map((i) => i.type)).toEqual(["note", "event"])
  })
  it("handles empty inputs", () => {
    expect(mergeTimeline([], [])).toEqual([])
  })
})

describe("clientProseName", () => {
  it("reads an Airtable 'Last | First' name as prose", () => {
    expect(clientProseName("Grey | Cleon")).toBe("Cleon Grey")
  })
  it("handles a one-part name", () => {
    expect(clientProseName("Grey")).toBe("Grey")
  })
  it("is empty when there's no name", () => {
    expect(clientProseName(null)).toBe("")
  })
})

describe("clientActor", () => {
  it("names the client in timeline entries", () => {
    expect(clientActor("Cleon Grey")).toBe("Client Cleon Grey")
  })
  it("falls back to a bare 'Client' when the name is unknown", () => {
    expect(clientActor("")).toBe("Client")
    expect(clientActor(undefined)).toBe("Client")
  })
})
