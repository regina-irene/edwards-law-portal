"use server"

import { revalidatePath } from "next/cache"
import { setClientLabel } from "@/lib/client-labels"
import { sql } from "@/lib/db"

export async function dismissActivity(eventId: string) {
  await sql`INSERT INTO dismissed_activity (event_id) VALUES (${eventId}) ON CONFLICT (event_id) DO NOTHING`.catch(() => {})
  revalidatePath("/admin")
}

export async function refreshClients() {
  // The /admin page fetches fresh from Airtable on each render, so re-rendering
  // the path is enough to pull the latest data and update the timestamp.
  revalidatePath("/admin")
}

export async function saveClientLabel(clientId: string, label: string) {
  await setClientLabel(clientId, label.trim())
  revalidatePath("/admin")
}
