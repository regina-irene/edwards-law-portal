import { render } from "@testing-library/react"
import "@testing-library/jest-dom"
import Motif from "@/components/ui/Motif"

describe("Motif", () => {
  it("renders the firm logo hidden from screen readers and print", () => {
    const { container } = render(<Motif />)
    const wrapper = container.firstElementChild as HTMLElement
    expect(wrapper.getAttribute("aria-hidden")).toBe("true")
    expect(wrapper.className).toContain("print:hidden")
    expect(wrapper.className).toContain("pointer-events-none")
    expect(container.querySelector("img")?.getAttribute("src")).toBe("/efl-logo.png")
  })
})
