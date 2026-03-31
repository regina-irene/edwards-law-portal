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
})
