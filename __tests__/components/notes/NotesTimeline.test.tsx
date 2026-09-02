import { render, screen, fireEvent } from "@testing-library/react"
import "@testing-library/jest-dom"
import NotesTimeline from "@/components/notes/NotesTimeline"
import type { TimelineItem } from "@/lib/notes-timeline"

jest.mock("@/components/ui/RichTextEditor", () => ({
  RichTextEditor: ({ value, onChange }: { value: string; onChange: (h: string) => void }) => (
    <textarea data-testid="editor" value={value} onChange={(e) => onChange(e.target.value)} />
  ),
}))

jest.mock("@/components/ui/RichTextView", () => ({
  RichTextView: ({ html }: { html: string }) => <div data-testid="view">{html}</div>,
}))

const items: TimelineItem[] = [
  { type: "note", at: "2026-07-24T10:00:00Z", note: { id: "n1", body: "<p>Strategy call</p>", created_at: "2026-07-24T10:00:00Z", updated_at: null, author_name: "Regina", author_email: "regina@x.com" } },
  { type: "note", at: "2026-07-22T10:00:00Z", note: { id: "n2", body: "<p>Filed answer</p>", created_at: "2026-07-22T10:00:00Z", updated_at: null, author_name: "Paralegal Pat", author_email: "pat@x.com" } },
  { type: "event", at: "2026-07-23T10:00:00Z", event: { id: "e1", kind: "upload", at: "2026-07-23T10:00:00Z", sender: "client", detail: "Client uploaded W2.pdf" } },
]

describe("NotesTimeline", () => {
  it("renders notes and events", () => {
    render(<NotesTimeline clientId="rec1" initialItems={items} />)
    expect(screen.getAllByTestId("view")[0]).toHaveTextContent("Strategy call")
    expect(screen.getByText(/Client uploaded W2.pdf/)).toBeInTheDocument()
  })

  it("'Just my notes' filter hides events", () => {
    render(<NotesTimeline clientId="rec1" initialItems={items} />)
    fireEvent.click(screen.getByRole("button", { name: /just my notes/i }))
    expect(screen.queryByText(/Client uploaded W2.pdf/)).not.toBeInTheDocument()
    expect(screen.getAllByTestId("view")).toHaveLength(2)
  })

  it("shows who wrote each note", () => {
    render(<NotesTimeline clientId="rec1" initialItems={items} />)
    expect(screen.getAllByText(/· Regina/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/· Paralegal Pat/).length).toBeGreaterThan(0)
  })

  it("'Written by' keeps only that person's notes", () => {
    render(<NotesTimeline clientId="rec1" initialItems={items} />)
    fireEvent.change(screen.getByLabelText(/written by/i), { target: { value: "Regina" } })
    const views = screen.getAllByTestId("view")
    expect(views).toHaveLength(1)
    expect(views[0]).toHaveTextContent("Strategy call")
    expect(screen.queryByText(/Client uploaded W2.pdf/)).not.toBeInTheDocument()
  })
})

describe("file links", () => {
  const withFiles: TimelineItem[] = [
    { type: "event", at: "2026-08-13T10:00:00Z", event: { id: "e2", kind: "upload", at: "2026-08-13T10:00:00Z", sender: "client", detail: "Client Cleon Grey uploaded W2.pdf", href: "/api/task-files/abc", linkLabel: "Open file" } },
    { type: "event", at: "2026-08-12T10:00:00Z", event: { id: "e3", kind: "upload", at: "2026-08-12T10:00:00Z", sender: "client", detail: "Client Cleon Grey sent bank.pdf to the firm's Drive folder", href: "https://drive.google.com/file/d/xyz/view", linkLabel: "Open in Drive" } },
    { type: "event", at: "2026-08-11T10:00:00Z", event: { id: "e4", kind: "chat", at: "2026-08-11T10:00:00Z", sender: "client", detail: "Client Cleon Grey sent a message: \"hi\"" } },
  ]

  // The ENTRY is the link now, not a small "Open file" tacked on the end
  // (2026-08-22), so these look it up by the text on screen. The thing each
  // test actually cares about - where the entry leads - is unchanged.
  it("links an uploaded file to its download route", () => {
    render(<NotesTimeline clientId="rec1" initialItems={withFiles} />)
    expect(screen.getByRole("link", { name: /uploaded W2\.pdf/i })).toHaveAttribute(
      "href",
      "/api/task-files/abc"
    )
  })

  it("links a Drive delivery straight to Drive", () => {
    render(<NotesTimeline clientId="rec1" initialItems={withFiles} />)
    expect(screen.getByRole("link", { name: /Drive folder/i })).toHaveAttribute(
      "href",
      "https://drive.google.com/file/d/xyz/view"
    )
  })

  it("leaves entries with no destination unlinked", () => {
    render(<NotesTimeline clientId="rec1" initialItems={withFiles} />)
    expect(screen.getAllByRole("link")).toHaveLength(2)
  })

  it("takes a client's message through to the conversation, in the same tab", () => {
    const withChat: TimelineItem[] = [
      {
        type: "event",
        at: "2026-08-11T10:00:00Z",
        event: {
          id: "e5",
          kind: "chat",
          at: "2026-08-11T10:00:00Z",
          sender: "client",
          detail: 'Client Cleon Grey sent a message: "can we move Friday"',
          href: "/admin/messages?c=rec1",
          linkLabel: "Open conversation",
        },
      },
    ]
    render(<NotesTimeline clientId="rec1" initialItems={withChat} />)
    const link = screen.getByRole("link", { name: /can we move Friday/i })
    expect(link).toHaveAttribute("href", "/admin/messages?c=rec1")
    // A page inside the portal replaces the current one; only files and
    // outside addresses get a new tab.
    expect(link).not.toHaveAttribute("target")
  })

  it("opens a file in a new tab", () => {
    render(<NotesTimeline clientId="rec1" initialItems={withFiles} />)
    expect(screen.getByRole("link", { name: /uploaded W2\.pdf/i })).toHaveAttribute("target", "_blank")
  })
})
