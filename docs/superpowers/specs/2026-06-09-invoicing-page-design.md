# Case Status / Invoicing Page — Flat-Fee Billing Design

**Date:** 2026-06-09
**Status:** Approved by Regina (in conversation). Airtable tables created. (Earlier idea of
syncing the internal "Owed $" board / reading the firm-wide Payments board was dropped at
Regina's request — the portal uses ONLY the two new tables below.)

## Goal

The client-facing "Case Status / Invoicing" page (the built-in `status` page, renamed) shows
flat-fee billing: total fees, amount paid, balance, a payment schedule, and a Pay Now button —
above the existing Status of Case section. Layout chosen: "Balance banner on top" (option A
from visual mockups in `.superpowers/brainstorm/`).

## Data model (in the existing main Airtable base `appAuA3Ifddk44H5m`)

### Client Fees — `tble8ZgwrvPnA9511` (created 2026-06-09)

One row per fee the client owes. Flat fee = first row; payment-plan installments = one row
each; fees added later (trial prep, 2nd mediation, GAL, etc.) = new rows anytime.

| Field | ID | Type |
|---|---|---|
| Description (primary) | `fldZ4w6maxdZqXE0A` | singleLineText — shown to client |
| Amount | `fldvrAEygPNm76jUQ` | currency $ |
| Due Date | `fldHwDRPlONkUhBHB` | date (US) |
| Client | `fldj3F5SWOR0SABNG` | link → Clients `tblPPcVwWJ3IjBRLu` (inverse on Clients: `fldfMiuatMda6JjcX` "Client Fees") |
| Notes | `fldeuu61DKYB32Mx5` | multilineText — internal only |

### Client Payments — `tblJF6czEn0LovTGq` (created 2026-06-09)

One row per payment received. Refund = negative amount.

| Field | ID | Type |
|---|---|---|
| Description (primary) | `fldlvyeUKxOop1jHj` | singleLineText — shown to client |
| Amount | `fldj4itnsxY3Y1dud` | currency $ |
| Payment Date | `fldlSsB8Nhvd88LR4` | date (US) |
| Client | `fldiYDn11BY6cNfa4` | link → Clients (inverse on Clients: `fldToWNVm9buL8T8o` "Client Payments") |
| Notes | `fldiAtrDbGjNIfWFW` | multilineText — internal only |

Note: the Owed $ table also gained a `Client` link field (`fld3zc6kZnphgZkxd`) before the
sync idea was dropped — unused by the portal; Regina may delete it.

## Math (computed in the portal, no Airtable formulas)

- **Total fees** = sum of the client's Client Fees rows.
- **Paid** = sum of the client's Client Payments rows.
- **Balance** = fees − paid (can go negative → show $0 balance / credit).
- Schedule: payments apply oldest-fee-first (by Due Date asc, undated last, then row order) →
  each fee shows Paid / Partial / Due. No manual matching.

## Page layout (client `status` page)

1. PageHeader (existing editable header/announcement)
2. **Balance banner**: Total Fees · Paid · Balance · "Pay Now →" button → `https://tinyurl.com/eflpay` (same link for all clients, opens in new tab)
3. **Payment Schedule** card: one row per fee — description, due date, amount, Paid / Due / Partial badge
4. **Payments received** list (description, date, amount) — small, under the schedule
5. **Status of Your Case** card (existing content, unchanged)

## Fallbacks

- Client has no Client Fees rows AND no payments (or pro bono): no billing section at all —
  page looks like today.
- Airtable fetch failure: show case status; omit billing section rather than erroring.

## Fetch path

Portal client (email → Clients record `id`) → list Client Fees and Client Payments rows,
filter in code where the `Client` link array contains the client's record id (link fields
return record-ID arrays; volume is small). Reuse the `lib/airtable.ts` fetch helper
(60s revalidate). Pure math lives in a separate function so it can be unit-tested.

## Out of scope (discussed, not building now)

- Per-client payment links / amounts pre-filled
- Online payment processing inside the portal (Pay Now just opens her existing link)
- Admin UI for fees/payments (managed directly in Airtable)
- Reading the firm-wide Payments board or the Owed $ board
