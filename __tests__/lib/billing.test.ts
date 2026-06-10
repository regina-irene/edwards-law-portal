import { computeBilling, type FeeRow } from "@/lib/billing"

const fee = (over: Partial<FeeRow> = {}): FeeRow => ({
  id: "fee1",
  description: "Flat fee",
  amount: 4500,
  dueDate: "2026-03-01",
  paid: false,
  ...over,
})

describe("computeBilling", () => {
  it("returns null when the client has no fee rows", () => {
    expect(computeBilling([])).toBeNull()
  })

  it("totals fees and shows everything due when nothing is paid", () => {
    const result = computeBilling([fee()])!
    expect(result.totalFees).toBe(4500)
    expect(result.totalPaid).toBe(0)
    expect(result.balance).toBe(4500)
    expect(result.schedule[0].paid).toBe(false)
  })

  it("counts rows marked Paid toward the paid total", () => {
    const result = computeBilling([
      fee({ id: "f1", amount: 1500, paid: true }),
      fee({ id: "f2", amount: 1500, dueDate: "2026-04-01" }),
    ])!
    expect(result.totalFees).toBe(3000)
    expect(result.totalPaid).toBe(1500)
    expect(result.balance).toBe(1500)
  })

  it("sorts the schedule by due date with undated fees last", () => {
    const result = computeBilling([
      fee({ id: "f3", dueDate: null }),
      fee({ id: "f2", dueDate: "2026-07-01" }),
      fee({ id: "f1", dueDate: "2026-03-01" }),
    ])!
    expect(result.schedule.map((s) => s.id)).toEqual(["f1", "f2", "f3"])
  })

  it("treats negative amounts (credits) as reducing the totals", () => {
    const result = computeBilling([
      fee({ id: "f1", amount: 3000 }),
      fee({ id: "f2", description: "Credit", amount: -500 }),
    ])!
    expect(result.totalFees).toBe(2500)
    expect(result.balance).toBe(2500)
  })

  it("shows a zero balance when every fee is paid", () => {
    const result = computeBilling([fee({ paid: true })])!
    expect(result.balance).toBe(0)
  })
})
