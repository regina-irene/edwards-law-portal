"use server"

import { revalidatePath } from "next/cache"

export async function refreshCalendarPage() {
  // Events are fetched live from Airtable (no-store) on each render.
  revalidatePath("/calendar")
}
