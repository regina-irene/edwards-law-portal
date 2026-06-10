// lib/twilio.ts — SMS via Twilio. Fails soft: if credentials are missing or
// still placeholders, sends are skipped with a human-readable reason instead
// of erroring.
import twilio from "twilio"

export interface SmsResult {
  sent: boolean
  reason?: string
}

function getConfig(): { client: ReturnType<typeof twilio>; from: string } | null {
  const sid = process.env.TWILIO_ACCOUNT_SID
  const token = process.env.TWILIO_AUTH_TOKEN
  const from = process.env.TWILIO_FROM_NUMBER
  // real Twilio SIDs start with "AC" — placeholders don't
  if (!sid || !token || !from || !sid.startsWith("AC")) return null
  return { client: twilio(sid, token), from }
}

// "(404) 555-1234" → "+14045551234". Returns "" when it can't make sense of it.
export function toE164(phone: string): string {
  const trimmed = (phone ?? "").trim()
  if (/^\+\d{8,15}$/.test(trimmed)) return trimmed
  const digits = trimmed.replace(/\D/g, "")
  if (digits.length === 10) return `+1${digits}`
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`
  return ""
}

export async function sendSms(to: string, body: string): Promise<SmsResult> {
  const cfg = getConfig()
  if (!cfg) return { sent: false, reason: "SMS is not configured (Twilio credentials are missing)" }
  const e164 = toE164(to)
  if (!e164) return { sent: false, reason: `Phone number on file looks invalid (${to || "none"})` }
  try {
    await cfg.client.messages.create({ to: e164, from: cfg.from, body })
    return { sent: true }
  } catch (e) {
    console.error("[twilio] send failed:", e)
    return { sent: false, reason: "Text failed to send (Twilio error)" }
  }
}

interface ReminderSMSOptions {
  to: string
  clientName: string
  taskName: string
  overdue: boolean
}

// Task due-date reminder (used by the daily cron alongside email reminders).
export async function sendReminderSMS(opts: ReminderSMSOptions): Promise<void> {
  const PORTAL_URL = process.env.AUTH_URL ?? "https://edwards-law-portal.vercel.app"
  const body = opts.overdue
    ? `URGENT from Edwards Family Law: "${opts.taskName}" is overdue. Please log in to your portal as soon as possible: ${PORTAL_URL}`
    : `Reminder from Edwards Family Law: "${opts.taskName}" is due soon. Log in to your portal: ${PORTAL_URL}`
  await sendSms(opts.to, body)
}
