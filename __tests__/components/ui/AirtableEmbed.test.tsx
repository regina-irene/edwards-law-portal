import { render, screen } from "@testing-library/react"
import AirtableEmbed from "@/components/ui/AirtableEmbed"

describe("AirtableEmbed", () => {
  it("renders iframe with correct src", () => {
    render(<AirtableEmbed url="https://airtable.com/embed/test" title="Pleadings" />)
    const iframe = screen.getByTitle("Pleadings")
    expect(iframe).toHaveAttribute("src", "https://airtable.com/embed/test")
  })

  it("renders fallback link", () => {
    render(<AirtableEmbed url="https://airtable.com/embed/test" title="Pleadings" />)
    const link = screen.getByRole("link", { name: /open pleadings/i })
    expect(link).toHaveAttribute("href", "https://airtable.com/embed/test")
    expect(link).toHaveAttribute("target", "_blank")
  })

  it("shows not configured message when url is empty", () => {
    render(<AirtableEmbed url="" title="Pleadings" />)
    expect(screen.getByText(/view not configured/i)).toBeInTheDocument()
    expect(screen.queryByTitle("Pleadings")).not.toBeInTheDocument()
  })

  it("renders always-visible new tab link when url is provided", () => {
    render(<AirtableEmbed url="https://airtable.com/embed/test" title="Pleadings" />)
    const links = screen.getAllByRole("link", { name: /pleadings/i })
    const newTabLink = links.find(l => l.getAttribute("href") === "https://airtable.com/embed/test")
    expect(newTabLink).toBeTruthy()
    expect(newTabLink).toHaveAttribute("target", "_blank")
  })
})
