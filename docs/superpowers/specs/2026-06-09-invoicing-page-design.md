# Case Status / Invoicing Page — Flat-Fee Billing Design

**Date:** 2026-06-09 (final revision after Regina consolidated to one board)
**Status:** Shipped.

## Goal

The client-facing "Case Status / Invoicing" page (the built-in `status` page, renamed) shows
flat-fee billing: total fees, paid, balance, a payment schedule, and a Pay Now button —
above the existing Status of Case section, on an ocean-blue gradient background.
Layout: "Balance banner on top" (option A from visual mockups).

## Data model — ONE board

**"Client Payments" `tblJF6czEn0LovTGq`** in the main Airtable base `appAuA3Ifddk44H5m`.
Each row = one fee the client owes (flat fee, installment, or fee added later).

| Field | ID | Type |
|---|---|---|
| Description (primary) | `fldlvyeUKxOop1jHj` | singleLineText — shown to client |
| Amount | `fldj4itnsxY3Y1dud` | currency $ (negative = credit) |
| Due Date | `fldlSsB8Nhvd88LR4` | date (renamed from "Payment Date") |
| Client | `fldiYDn11BY6cNfa4` | link → Clients `tblPPcVwWJ3IjBRLu` (inverse: `fldToWNVm9buL8T8o`) |
| Status | `fldoGlftHveDGznJa` | singleSelect Due `selrNrkz8LPRAfMT9` / Paid `sel7QV2c5x7CE4YMO` — blank counts as Due |
| Notes | `fldiAtrDbGjNIfWFW` | multilineText — internal only |

Regina flips **Status → Paid** when a payment comes in. **Rows with no Amount are ignored**
(she bulk-linked all 34 clients with empty rows; those are placeholders).

History: an earlier two-table design ("Client Fees" `tble8ZgwrvPnA9511` + Client Payments)
shipped first, but Regina deleted the Client Fees table in Airtable (its inverse field on
Clients, `fldfMiuatMda6JjcX`, degraded to singleLineText) — that's why the page briefly
showed nothing. Code now reads ONLY "Client Payments" by table name. Also rejected earlier:
syncing the internal "Owed $" board and reading the firm-wide "Payments" board. Leftover
columns Regina may delete by hand: Clients."Client Fees", Clients."Owed $"/"Owed $ 2"/
"Owed $ 3", Owed $."Client" (`fld3zc6kZnphgZkxd`).

## Math

- Total Fees = sum of the client's rows; Paid = sum of rows marked Paid;
  Balance = max(total − paid, 0) for display.
- Schedule sorted by Due Date asc, undated last; badge straight from Status.

## Code

- `lib/billing.ts` — `getClientBilling(clientRecordId)` fetches the table (60s revalidate,
  paginated), filters rows whose `Client` link array contains the Clients record id
  (`AirtableClient.id`) and Amount ≠ 0; pure `computeBilling()` is unit-tested in
  `__tests__/lib/billing.test.ts`. Fails soft (null → no billing section).
- `components/billing/BillingSection.tsx` — banner (Total/Paid/Balance/Pay Now →
  `https://tinyurl.com/eflpay`, new tab) + schedule card.
- `app/(client)/status/page.tsx` — renders BillingSection between PageHeader and the
  Status of Your Case card; whole page wrapped in the ocean gradient (-m-6 over the
  layout's cream background).

## Fallbacks

- No fee rows (or only empty placeholder rows) → page renders exactly as before billing existed.
- Airtable fetch failure → case status still shows; billing section omitted.
