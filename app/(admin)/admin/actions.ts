"use server"

import { revalidatePath } from "next/cache"
import { setClientLabel } from "@/lib/client-labels"
import { revalidateClients } from "@/lib/airtable"
import { sql } from "@/lib/db"

export async function dismissActivity(eventId: string) {
  await sql`INSERT INTO dismissed_activity (event_id) VALUES (${eventId}) ON CONFLICT (event_id) DO NOTHING`.catch(() => {})
  revalidatePath("/admin")
}

export async function refreshClients() {
  // The roster is now cached for 60s under the "clients" tag (2026-08-18), so
  // re-rendering the path alone would just replay the cached copy. Bust the
  // tag first, then re-render both /admin and /admin/clients, because the
  // Refresh button lives on the Clients page too.
  revalidateClients()
  revalidatePath("/admin")
  revalidatePath("/admin/clients")
}

export async function saveClientLabel(clientId: string, label: string) {
  await setClientLabel(clientId, label.trim())
  revalidatePath("/admin")
}
