# Case Status / Invoicing Page — Flat-Fee Billing Design

**Date:** 2026-06-09
**Status:** Approved by Regina (in conversation). Airtable table created.

## Goal

The client-facing "Case Status / Invoicing" page (the built-in `status` page, renamed) shows
flat-fee billing: total fees, amount paid, balance, a payment schedule, and a Pay Now button —
above the existing Status of Case section. Layout chosen: "Balance banner on top" (option A
from visual mockups in `.superpowers/brainstorm/`).

## Data model (all in the existing main Airtable base `appAuA3Ifddk44H5m`)

### New: Client Fees table — `tble8ZgwrvPnA9511` (created 2026-06-09)

One row per fee the client owes. Flat fee = first row; payment-plan installments = one row
each; fees added later (trial prep, 2nd mediation, GAL, etc.) = new rows anytime.

| Field | ID | Type |
|---|---|---|
| Description (primary) | `fldZ4w6maxdZqXE0A` | singleLineText — shown to client |
| Amount | `fldvrAEygPNm76jUQ` | currency $ |
| Due Date | `fldHwDRPlONkUhBHB` | date (US) |
| Client | `fldj3F5SWOR0SABNG` | link → Clients `tblPPcVwWJ3IjBRLu` (inverse field on Clients: `fldfMiuatMda6JjcX` "Client Fees") |
| Notes | `fldeuu61DKYB32Mx5` | multilineText — internal only |

### Existing tables used read-only

- **Clients** `tblPPcVwWJ3IjBRLu` — portal already reads this; has `Status - Client Board`
  link → Status table.
- **Status** `tbl3gCA0CQ0S6ewW6` — case board; `Client Payments` (`fld61OYfd6rwgGInz`)
  links → Payments.
- **Payments** `tblwulRnma9qIKasp` — every payment received. Fields used: `Amount`
  (currency), `Cleared?` (singleSelect: Yes / Pending / Bounced — note there are TWO "Yes"
  choices, "Yes" and "Yes " with trailing space; match trimmed), `Type of Payment`
  (refund types: "Refund", "Refund (partial)"), `Payment Date`, `Case Name` (link → Status).

## Math (computed in the portal, no Airtable formulas)

- **Total fees** = sum of the client's Client Fees rows.
- **Paid** = sum of Payments linked to the client's Status record(s) where trimmed
  `Cleared?` = "Yes". Types containing "Refund" subtract (negate positive amounts).
- **Balance** = fees − paid.
- Schedule rows: payments apply oldest-fee-first (by Due Date, then row order) → each fee
  shows Paid / Partial / Due. No manual matching.

## Page layout (client `status` page)

1. PageHeader (existing editable header/announcement)
2. **Balance banner**: Total Fees · Paid · Balance · "Pay Now →" button → `https://tinyurl.com/eflpay` (same link for all clients, opens in new tab)
3. **Payment Schedule** card: one row per fee — description, due date, amount, ✅ Paid / 🔶 Due / partial badge
4. **Status of Your Case** card (existing content, unchanged)

## Fallbacks

- Client has no Client Fees rows (or pro bono): no billing section at all — page looks like today.
- Pending/Bounced payments don't count toward Paid.
- Airtable fetch failure: show case status; omit billing section rather than erroring.

## Fetch path

Portal client (email → Clients record) → `Status - Client Board` record IDs → Payments rows
whose `Case Name` contains one of those IDs; Client Fees rows whose `Client` contains the
Clients record ID. Linked-record filtering done in code on the returned arrays (record-ID
arrays come back in link fields). Volume is small. Reuse `lib/airtable.ts` fetch helper
(60s revalidate).

## Out of scope (discussed, not building now)

- Per-client payment links / amounts pre-filled
- Online payment processing inside the portal (Pay Now just opens her existing link)
- Admin UI for fees (managed directly in Airtable)
