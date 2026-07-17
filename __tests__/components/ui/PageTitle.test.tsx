import { render, screen } from "@testing-library/react"
import "@testing-library/jest-dom"
import PageTitle from "@/components/ui/PageTitle"

describe("PageTitle", () => {
  it("renders the title as a heading", () => {
    render(<PageTitle title="Calendar / Meetings" />)
    expect(screen.getByRole("heading", { name: "Calendar / Meetings" })).toBeInTheDocument()
  })
  it("renders the tagline when given", () => {
    render(<PageTitle title="Calendar" tagline="Every date in your case, in one place" />)
    expect(screen.getByText("Every date in your case, in one place")).toBeInTheDocument()
  })
  it("renders nothing extra when tagline is null", () => {
    const { container } = render(<PageTitle title="My Page" tagline={null} />)
    expect(container.querySelectorAll("p").length).toBe(0)
  })
})
