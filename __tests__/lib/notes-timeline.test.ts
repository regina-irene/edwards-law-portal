import { mergeTimeline, type TimelineEvent } from "@/lib/notes-timeline"
import type { ClientNote } from "@/lib/notes"

const note = (id: string, at: string): ClientNote => ({ id, body: "<p>n</p>", created_at: at, updated_at: null })
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
    const a = mergeTimeline([note("n1", "2026-07-10T10:00:00Z")], [event("e9", "2026-07-10T10:00:00Z")])
    const b = mergeTimeline([note("n1", "2026-07-10T10:00:00Z")], [event("e9", "2026-07-10T10:00:00Z")])
    expect(a.map((i) => i.type)).toEqual(b.map((i) => i.type))
  })
  it("handles empty inputs", () => {
    expect(mergeTimeline([], [])).toEqual([])
  })
})
