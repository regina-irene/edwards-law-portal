// app/api/sms/incoming/route.ts - Twilio webhook for texts clients send TO the
// firm's Twilio number. Matched texts land in that client's Message Center
// conversation (tagged as received-by-text); unmatched numbers are forwarded
// to the firm cell so nothing vanishes.
import { NextResponse } from "next/server"
import twilio from "twilio"
import { sql } from "@/lib/db"
import { getAllClients, clientDisplayLabel } from "@/lib/airtable"
import { getWatch, getAdminPhone } from "@/lib/sms-watch"
import { sendSms, toE164 } from "@/lib/twilio"

const EMPTY_TWIML = `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`

function twiml() {
  return new NextResponse(EMPTY_TWIML, { status: 200, headers: { "Content-Type": "text/xml" } })
}

export async function POST(req: Request) {
  const form = await req.formData()
  const params: Record<string, string> = {}
  for (const [k, v] of form.entries()) params[k] = String(v)

  // verify the request really came from Twilio
  const authToken = process.env.TWILIO_AUTH_TOKEN
  const signature = req.headers.get("x-twilio-signature") ?? ""
  const url = `${process.env.AUTH_URL ?? "https://edwards-law-portal.vercel.app"}/api/sms/incoming`
  if (!authToken || !twilio.validateRequest(authToken, signature, url, params)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 403 })
  }

  const from = (params.From ?? "").trim()
  const body = (params.Body ?? "").trim()
  if (!from || !body) return twiml()

  try {
    const clients = await getAllClients()
    const client = clients.find((c) => toE164(c.phone) === from)
    const adminPhone = await getAdminPhone()

    if (!client) {
      // no matching client - forward to the firm cell so it isn't lost
      if (adminPhone) {
        await sendSms(adminPhone, `📨 Text from unknown number ${from}:\n\n"${body.slice(0, 200)}"`)
      }
      return twiml()
    }

    const cid = String(client.clientId)
    await sql`
      INSERT INTO chat_messages (client_id, sender, body, sms_status)
      VALUES (${cid}, 'client', ${body}, 'inbound')
    `

    // same alerting as a portal reply: notify the firm cell if the
    // "text me on reply" switch is on for this conversation
    if (adminPhone && (await getWatch(cid))) {
      const who = clientDisplayLabel(client.name) || client.name || "A client"
      await sendSms(adminPhone, `📨 ${who} texted back:\n\n"${body.slice(0, 140)}${body.length > 140 ? "…" : ""}"`)
    }
  } catch (e) {
    console.error("[sms/incoming] failed:", e)
  }

  return twiml()
}
