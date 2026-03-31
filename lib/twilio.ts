// lib/twilio.ts — SMS disabled until Twilio is configured
// To enable: install twilio package and replace this stub

interface ReminderSMSOptions {
  to: string
  clientName: string
  taskName: string
  overdue: boolean
}

export async function sendReminderSMS(opts: ReminderSMSOptions): Promise<void> {
  // SMS not yet configured — no-op until Twilio is set up
  console.log(`[SMS disabled] Would send to ${opts.to}: ${opts.taskName} (overdue: ${opts.overdue})`)
}
