# Edwards Law Client Portal — Design Spec
**Date:** 2026-03-30
**Domain:** portal.edwardslaw.com
**Deployment:** Vercel

---

## 1. Overview

A secure, web-based client portal for Edwards Family Law. Clients log in to view their case status, access document requests, review pleadings and discovery, chat with the firm, and see upcoming deadlines. The portal is a single Next.js application deployed on Vercel, backed by Airtable (per-client bases + main firm dashboard) and a small Vercel Postgres database for portal-specific data.

---

## 2. Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js (React, Tailwind CSS) |
| Backend | Next.js API Routes (Vercel serverless) |
| Database | Vercel Postgres |
| CMS / Data | Airtable (per-client bases + main base) |
| AI Layer | Claude API |
| Auth | NextAuth.js (Google OAuth + magic link) |
| Email | Resend |
| SMS | Twilio (opt-in per client) |
| File Uploads | FileFlow (external, https://fileflow-eta.vercel.app) |
| Domain | portal.edwardslaw.com via Vercel |

---

## 3. Authentication

### Methods
- **Google OAuth** — one-click sign in via NextAuth Google provider
- **Magic Link** — client enters email → receives a one-time link → auto-logged in, expires in 15 minutes

### Identity Resolution
On login, NextAuth matches the client's email against the `Email` field in the Airtable Clients table (main base). The matched `Client ID` is stored in the session and used to scope all subsequent Airtable queries to the correct per-client base.

### Security
- Session tokens stored in HTTP-only cookies (never exposed to JavaScript)
- Magic links expire after 15 minutes
- Every API route validates the session before any Airtable or database operation
- All API keys (Airtable, Claude, Resend, Twilio) stored in Vercel environment variables only
- Airtable is never called directly from the browser — all calls proxied through API routes

---

## 4. Pages & Navigation

### Nav Order
The sidebar/nav page order is configurable by the firm admin via a drag-and-drop admin setting. Order is stored in Vercel Postgres and applied at render time. No code changes required to reorder pages.

### Pages

#### `/login`
- Google OAuth button
- Email field for magic link
- Redirects to `/dashboard` on success

#### `/dashboard`
- Three-lane status view: **Outstanding** (red) / **In Progress** (yellow) / **Completed** (green)
- Data: Tasks pulled from client's Airtable base, sent to Claude server-side
- Claude returns structured JSON sections; frontend renders lanes
- Overdue items flagged with a red banner
- Each outstanding item shows: name, due date, status badge

#### `/document-requests`
- Desktop: FileFlow app embedded via iframe
- Mobile: "Open Document Portal" button opens FileFlow in a new tab
- FileFlow URL stored per-client in Airtable Clients table (`FileFlow Link` field)
- No sign-in required for FileFlow — link is pre-authenticated per client

#### `/pleadings`
- Embedded Airtable view (shared view link stored in Airtable Clients table)
- Read-only

#### `/discovery`
- Embedded Airtable view (shared view link stored in Airtable Clients table)
- Read-only

#### `/calendar`
- Embedded Airtable view (shared view link stored in Airtable Clients table)
- Read-only

#### `/messages`
- Firm → client announcements and updates
- One-way: firm posts, client reads
- Unread badge on nav tab
- Stored in Vercel Postgres

#### `/chat`
- Two-way conversation between client and firm
- Client submits message → stored in Vercel Postgres → firm sees in `/admin/chat`
- Firm replies → client sees on next load (60-second polling)
- Unread badge on nav tab
- Stored in Vercel Postgres

#### `/admin` (firm-only, protected route)
- Lists all clients with unread chat or message activity
- `/admin/chat/[clientId]` — firm reads and replies to client chat messages
- `/admin/messages/[clientId]` — firm composes and sends announcements to a client
- Protected: only accessible to authenticated firm staff (separate admin role in NextAuth)
- Admin users stored in Vercel Postgres with `role: admin`

---

## 5. Data Architecture

### Airtable (source of truth for case data)
- **Main base** — Clients table: Client ID, Name, Email, Phone, Portal Access Token, FileFlow Link, Airtable View Links (pleadings, discovery, calendar), SMS Reminders (Yes/No)
- **Per-client bases** — Tasks, Matters, Pleadings, Discovery (synced views)

### Vercel Postgres (portal-specific data)
```
messages
├── id (uuid)
├── client_id (text)
├── body (text)
├── created_at (timestamp)
└── read (boolean)

admin_users
├── id (uuid)
├── email (text)
├── name (text)
└── role (enum: admin)

chat_messages
├── id (uuid)
├── client_id (text)
├── sender (enum: client | firm)
├── body (text)
├── created_at (timestamp)
└── read (boolean)

nav_order
├── id (uuid)
└── pages (json array of page slugs in display order)
```

---

## 6. Claude Integration

Claude runs **server-side only** inside the `/api/claude` API route.

**Input:** Raw Airtable JSON for the client's tasks
**Output:** Structured JSON:
```json
{
  "sections": [
    {
      "title": "Outstanding Documents",
      "items": [
        {
          "name": "Bank Statement",
          "due_date": "2026-04-02",
          "status": "outstanding",
          "overdue": false
        }
      ]
    }
  ]
}
```

**System prompt rules:**
- Group into Outstanding / In Progress / Completed
- Flag overdue items
- Use plain English, not legal jargon
- Never surface internal-only fields
- Sort by due date ascending

---

## 7. Smart Reminders

Runs as a **Vercel Cron Job** (daily).

**Triggers:**
- 3 days before due date
- Day of due date
- 1 day after due date (overdue)

**Delivery:**
- Email via Resend — always on
- SMS via Twilio — only if `SMS Reminders = Yes` in Airtable Clients table

**Message content:**
- Claude generates plain-English reminder from the task record
- Includes the specific item name and a direct link to `portal.edwardslaw.com`

---

## 8. Security Model

- No Airtable API keys in the browser — all calls proxied through API routes
- Sessions validated on every API route before data is returned
- Clients can only access data scoped to their `client_id`
- Magic links are single-use and expire in 15 minutes
- Environment variables managed in Vercel dashboard (not in code)
- FileFlow links are pre-shared per client and stored in Airtable — not publicly discoverable

---

## 9. Out of Scope (this version)

- Google Calendar sync
- Multi-firm / multi-tenant support
- Client ability to edit or add calendar dates
- Real-time websocket chat (polling every 60s is sufficient)
- Document preview inside the portal (FileFlow handles this)
