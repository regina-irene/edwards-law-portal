"use server"

import { revalidatePath } from "next/cache"

export async function refreshPleadingsPage() {
  // The pleadings table is fetched live from Airtable (no-store) on each
  // render, so re-rendering the path pulls the latest data and updates the
  // "Last refreshed" timestamp.
  revalidatePath("/pleadings")
}
