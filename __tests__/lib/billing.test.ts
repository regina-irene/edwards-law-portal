import { computeBilling, type FeeRow, type PaymentRow } from "@/lib/billing"

const fee = (over: Partial<FeeRow> = {}): FeeRow => ({
  id: "fee1",
  description: "Flat fee",
  amount: 4500,
  dueDate: "2026-03-01",
  ...over,
})

const payment = (over: Partial<PaymentRow> = {}): PaymentRow => ({
  id: "pay1",
  description: "Payment",
  amount: 1500,
  date: "2026-03-01",
  ...over,
})

describe("computeBilling", () => {
  it("returns null when there are no fees and no payments", () => {
    expect(computeBilling([], [])).toBeNull()
  })

  it("shows all fees as due when nothing has been paid", () => {
    const result = computeBilling([fee()], [])!
    expect(result.totalFees).toBe(4500)
    expect(result.totalPaid).toBe(0)
    expect(result.balance).toBe(4500)
    expect(result.schedule[0].status).toBe("due")
    expect(result.schedule[0].paidAmount).toBe(0)
  })

  it("marks the oldest fee paid first", () => {
    const fees = [
      fee({ id: "f2", description: "Installment 2", dueDate: "2026-04-01", amount: 1500 }),
      fee({ id: "f1", description: "Retainer", dueDate: "2026-03-01", amount: 1500 }),
      fee({ id: "f3", description: "Installment 3", dueDate: "2026-07-01", amount: 1500 }),
    ]
    const result = computeBilling(fees, [payment({ amount: 1500 })])!
    const byId = Object.fromEntries(result.schedule.map((s) => [s.id, s]))
    expect(byId.f1.status).toBe("paid")
    expect(byId.f2.status).toBe("due")
    expect(byId.f3.status).toBe("due")
    // schedule is returned in due-date order
    expect(result.schedule.map((s) => s.id)).toEqual(["f1", "f2", "f3"])
  })

  it("marks a fee partial when a payment covers part of it", () => {
    const result = computeBilling([fee({ amount: 4500 })], [payment({ amount: 1000 })])!
    expect(result.schedule[0].status).toBe("partial")
    expect(result.schedule[0].paidAmount).toBe(1000)
    expect(result.balance).toBe(3500)
  })

  it("spreads one payment across multiple fees", () => {
    const fees = [
      fee({ id: "f1", dueDate: "2026-03-01", amount: 1500 }),
      fee({ id: "f2", dueDate: "2026-04-01", amount: 1500 }),
    ]
    const result = computeBilling(fees, [payment({ amount: 2000 })])!
    const byId = Object.fromEntries(result.schedule.map((s) => [s.id, s]))
    expect(byId.f1.status).toBe("paid")
    expect(byId.f2.status).toBe("partial")
    expect(byId.f2.paidAmount).toBe(500)
  })

  it("puts fees without a due date at the end of the schedule", () => {
    const fees = [
      fee({ id: "f2", dueDate: null, amount: 1200 }),
      fee({ id: "f1", dueDate: "2026-03-01", amount: 1500 }),
    ]
    const result = computeBilling(fees, [payment({ amount: 1500 })])!
    expect(result.schedule.map((s) => s.id)).toEqual(["f1", "f2"])
    expect(result.schedule[0].status).toBe("paid")
    expect(result.schedule[1].status).toBe("due")
  })

  it("treats negative payments (refunds) as reducing the amount paid", () => {
    const result = computeBilling(
      [fee({ amount: 3000 })],
      [payment({ id: "p1", amount: 1500 }), payment({ id: "p2", description: "Refund", amount: -500 })]
    )!
    expect(result.totalPaid).toBe(1000)
    expect(result.balance).toBe(2000)
    expect(result.schedule[0].status).toBe("partial")
  })

  it("reports a negative balance (credit) when payments exceed fees", () => {
    const result = computeBilling([fee({ amount: 1000 })], [payment({ amount: 1500 })])!
    expect(result.balance).toBe(-500)
    expect(result.schedule[0].status).toBe("paid")
  })

  it("still returns a summary when there are payments but no fees yet", () => {
    const result = computeBilling([], [payment({ amount: 500 })])!
    expect(result.totalFees).toBe(0)
    expect(result.totalPaid).toBe(500)
    expect(result.schedule).toEqual([])
  })

  it("lists payments newest first", () => {
    const result = computeBilling(
      [fee()],
      [
        payment({ id: "p1", date: "2026-03-01" }),
        payment({ id: "p2", date: "2026-05-01" }),
        payment({ id: "p3", date: null }),
      ]
    )!
    expect(result.payments.map((p) => p.id)).toEqual(["p2", "p1", "p3"])
  })
})
