// app/api/cron/reminders/route.ts
import { NextResponse } from "next/server"
import { getAllClients, getClientTasks } from "@/lib/airtable"
import { sendReminderEmail } from "@/lib/resend"
import { sendReminderSMS } from "@/lib/twilio"

// Returns true if dueDate is 0, 1, or 3 days from today, or past due
function shouldRemind(dueDate: string, today: Date): { remind: boolean; overdue: boolean } {
  const due = new Date(dueDate + "T00:00:00")
  const todayMidnight = new Date(today)
  todayMidnight.setHours(0, 0, 0, 0)

  const diffMs = due.getTime() - todayMidnight.getTime()
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays < 0) return { remind: true, overdue: true }   // past due
  if (diffDays === 0) return { remind: true, overdue: false } // due today
  if (diffDays === 3) return { remind: true, overdue: false } // 3 days out
  return { remind: false, overdue: false }
}

export async function GET(req: Request) {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 })
  }
  const authHeader = req.headers.get("authorization")
  const expected = `Bearer ${process.env.CRON_SECRET}`
  if (authHeader !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const today = new Date()
  // Archived clients are closed cases. Nothing here should text or email a
  // former client about a task on a file we've finished. (2026-08-18)
  const clients = (await getAllClients()).filter((c) => !c.archived)
  const results: { clientId: string; sent: number; errors: number }[] = []

  for (const client of clients) {
    let sent = 0
    let errors = 0

    try {
      const tasks = await getClientTasks(client.clientBaseId)
      const completedStatuses = ["complete", "completed", "done"]

      for (const task of tasks) {
        if (!task.dueDate) continue
        if (completedStatuses.includes(task.status.toLowerCase())) continue

        const { remind, overdue } = shouldRemind(task.dueDate, today)
        if (!remind) continue

        try {
          await sendReminderEmail({
            to: client.email,
            clientName: client.name,
            taskName: task.name,
            dueDate: task.dueDate,
            overdue,
          })
          sent++
        } catch (err) {
          console.error(`[cron] email failed for client ${client.clientId}:`, err)
          errors++
        }

        if (client.smsReminders && client.phone) {
          try {
            await sendReminderSMS({
              to: client.phone,
              clientName: client.name,
              taskName: task.name,
              overdue,
            })
            sent++
          } catch (err) {
            console.error(`[cron] SMS failed for client ${client.clientId}:`, err)
            errors++
          }
        }
      }
    } catch (err) {
      console.error(`[cron] failed to fetch tasks for client ${client.clientId}:`, err)
      errors++
    }

    results.push({ clientId: client.clientId, sent, errors })
  }

  return NextResponse.json({ ok: true, results })
}
