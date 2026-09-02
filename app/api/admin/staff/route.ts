// app/api/admin/staff/route.ts - who at the firm can sign in to the admin side
// (2026-08-22).
//
// The `admin_users` table IS the admin allowlist. It is checked by lib/admin on
// every admin page and API route, by lib/portal-client, and by auth.ts before a
// sign-in link is sent. Nothing else grants access: not Google Cloud IAM, not
// Google Workspace membership, not being in the firm's domain. Adding somebody
// to the Cloud project's IAM lets them administer the CLOUD PROJECT and has no
// effect here at all.
//
// Until now there was no way to add a row except by hand in the database, which
// is why "my staff can't get in" had no self-service answer.
import { NextResponse } from "next/server"
import { requireAdmin, displayNameFromEmail } from "@/lib/admin"
import { sql } from "@/lib/db"

export const dynamic = "force-dynamic"

/** Deliberately simple. Google verifies the address; this only catches typos. */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function GET() {
  const check = await requireAdmin()
  if (check.status !== "ok") return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const r = await sql`SELECT email, name FROM admin_users ORDER BY LOWER(email)`
    return NextResponse.json({
      staff: r.rows.map((row) => ({
        email: String(row.email),
        name: typeof row.name === "string" && row.name.trim() ? row.name.trim() : "",
      })),
      // So the UI can stop you removing your own access.
      you: check.email.toLowerCase(),
    })
  } catch {
    return NextResponse.json({ error: "Couldn't read the staff list." }, { status: 500 })
  }
}

export async function POST(req: Request) {
  const check = await requireAdmin()
  if (check.status !== "ok") return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = (await req.json().catch(() => null)) as { email?: unknown; name?: unknown } | null
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : ""
  const name = typeof body?.name === "string" ? body.name.trim() : ""

  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "That doesn't look like an email address." }, { status: 400 })
  }

  try {
    // Stored lower-cased so it can never drift from what the sign-in checks
    // compare against. ON CONFLICT keeps this idempotent: adding somebody twice
    // updates their name rather than failing.
    await sql`
      INSERT INTO admin_users (email, name)
      VALUES (${email}, ${name || displayNameFromEmail(email)})
      ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name
    `
    return NextResponse.json({ ok: true, email })
  } catch {
    return NextResponse.json({ error: "Couldn't add them just now." }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  const check = await requireAdmin()
  if (check.status !== "ok") return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const email = (new URL(req.url).searchParams.get("email") ?? "").trim().toLowerCase()
  if (!email) return NextResponse.json({ error: "An email is required." }, { status: 400 })

  // You cannot remove yourself. Not paternalism: this is the only table that
  // grants admin access and there is no way back in from outside it, so a
  // mis-click on your own row locks the firm out of its own portal.
  if (email === check.email.trim().toLowerCase()) {
    return NextResponse.json(
      { error: "You can't remove your own access - ask another admin to do it." },
      { status: 400 }
    )
  }

  try {
    const remaining = await sql`SELECT COUNT(*)::int AS c FROM admin_users`
    if ((remaining.rows[0]?.c ?? 0) <= 1) {
      return NextResponse.json(
        { error: "That's the last admin. Add someone else before removing this one." },
        { status: 400 }
      )
    }
    await sql`DELETE FROM admin_users WHERE LOWER(email) = ${email}`
    return NextResponse.json({ ok: true, email })
  } catch {
    return NextResponse.json({ error: "Couldn't remove them just now." }, { status: 500 })
  }
}
