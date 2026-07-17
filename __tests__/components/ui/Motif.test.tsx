import { render } from "@testing-library/react"
import "@testing-library/jest-dom"
import Motif, { MOTIF_DEFAULT } from "@/components/ui/Motif"

describe("Motif", () => {
  it("renders an svg that is hidden from screen readers and print", () => {
    const { container } = render(<Motif />)
    const wrapper = container.firstElementChild as HTMLElement
    expect(wrapper.getAttribute("aria-hidden")).toBe("true")
    expect(wrapper.className).toContain("print:hidden")
    expect(wrapper.className).toContain("pointer-events-none")
    expect(container.querySelector("svg")).toBeInTheDocument()
  })
  it("has a valid default variant", () => {
    expect(["magnolia", "rose", "scales"]).toContain(MOTIF_DEFAULT)
  })
})
