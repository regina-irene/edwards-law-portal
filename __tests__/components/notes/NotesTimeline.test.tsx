import { render, screen, fireEvent } from "@testing-library/react"
import "@testing-library/jest-dom"
import NotesTimeline from "@/components/notes/NotesTimeline"
import type { TimelineItem } from "@/lib/notes-timeline"

jest.mock("@/components/ui/RichTextEditor", () => ({
  RichTextEditor: ({ value, onChange }: { value: string; onChange: (h: string) => void }) => (
    <textarea data-testid="editor" value={value} onChange={(e) => onChange(e.target.value)} />
  ),
  RichTextView: ({ html }: { html: string }) => <div data-testid="view">{html}</div>,
}))

const items: TimelineItem[] = [
  { type: "note", at: "2026-07-24T10:00:00Z", note: { id: "n1", body: "<p>Strategy call</p>", created_at: "2026-07-24T10:00:00Z", updated_at: null } },
  { type: "event", at: "2026-07-23T10:00:00Z", event: { id: "e1", kind: "upload", at: "2026-07-23T10:00:00Z", sender: "client", detail: "Client uploaded W2.pdf" } },
]

describe("NotesTimeline", () => {
  it("renders notes and events", () => {
    render(<NotesTimeline clientId="rec1" initialItems={items} />)
    expect(screen.getByTestId("view")).toHaveTextContent("Strategy call")
    expect(screen.getByText(/Client uploaded W2.pdf/)).toBeInTheDocument()
  })

  it("'Just my notes' filter hides events", () => {
    render(<NotesTimeline clientId="rec1" initialItems={items} />)
    fireEvent.click(screen.getByRole("button", { name: /just my notes/i }))
    expect(screen.queryByText(/Client uploaded W2.pdf/)).not.toBeInTheDocument()
    expect(screen.getByTestId("view")).toBeInTheDocument()
  })
})
