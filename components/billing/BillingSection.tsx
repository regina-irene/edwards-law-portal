// components/billing/BillingSection.tsx — flat-fee billing on the Case Status /
// Invoicing page: balance banner, payment schedule, payments received.
import { PAY_NOW_URL, type BillingSummary, type ScheduleItem } from "@/lib/billing"

function money(n: number): string {
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: Number.isInteger(n) ? 0 : 2,
    maximumFractionDigits: 2,
  })
}

// Date-only strings ("2026-07-01") — anchor to local midnight so the day never shifts.
function dueDate(d: string): string {
  return new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

function StatusBadge({ item }: { item: ScheduleItem }) {
  if (item.status === "paid") {
    return <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-green-100 text-green-800">Paid</span>
  }
  if (item.status === "partial") {
    return (
      <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
        {money(item.paidAmount)} paid
      </span>
    )
  }
  return <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">Due</span>
}

export default function BillingSection({ billing }: { billing: BillingSummary }) {
  const balanceDue = Math.max(billing.balance, 0)
  const credit = billing.balance < 0 ? -billing.balance : 0

  return (
    <div className="space-y-6">
      {/* Balance banner */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white rounded-lg border border-gray-200 p-4 text-center">
          <p className="text-xs uppercase tracking-wide text-gray-500">Total Fees</p>
          <p className="text-xl font-semibold text-gray-900 mt-1">{money(billing.totalFees)}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4 text-center">
          <p className="text-xs uppercase tracking-wide text-gray-500">Paid</p>
          <p className="text-xl font-semibold text-green-700 mt-1">{money(billing.totalPaid)}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4 text-center">
          <p className="text-xs uppercase tracking-wide text-gray-500">Balance</p>
          <p className={`text-xl font-semibold mt-1 ${balanceDue > 0 ? "text-amber-700" : "text-green-700"}`}>
            {money(balanceDue)}
          </p>
          {credit > 0 && <p className="text-xs text-green-700">{money(credit)} credit</p>}
        </div>
        <a
          href={PAY_NOW_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center rounded-lg px-4 py-4 text-white text-sm font-semibold hover:opacity-90 transition-opacity"
          style={{ background: "#1b2d45" }}
        >
          Pay Now →
        </a>
      </div>

      {/* Payment schedule */}
      {billing.schedule.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-xs uppercase tracking-wide text-gray-500 mb-3">Payment Schedule</h2>
          <ul className="divide-y divide-gray-100">
            {billing.schedule.map((item) => (
              <li key={item.id} className="py-2.5 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm text-gray-800 truncate">{item.description}</p>
                  {item.dueDate && <p className="text-xs text-gray-500">Due {dueDate(item.dueDate)}</p>}
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-sm font-medium text-gray-900">{money(item.amount)}</span>
                  <StatusBadge item={item} />
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Payments received */}
      {billing.payments.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-xs uppercase tracking-wide text-gray-500 mb-3">Payments Received</h2>
          <ul className="divide-y divide-gray-100">
            {billing.payments.map((p) => (
              <li key={p.id} className="py-2 flex items-center justify-between gap-3 text-sm">
                <span className="text-gray-700 truncate">
                  {p.description}
                  {p.date && <span className="text-gray-400"> · {dueDate(p.date)}</span>}
                </span>
                <span className={`font-medium shrink-0 ${p.amount < 0 ? "text-red-700" : "text-gray-900"}`}>
                  {money(p.amount)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
