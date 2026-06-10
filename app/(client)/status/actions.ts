"use server"

import { revalidatePath } from "next/cache"

export async function refreshStatusPage() {
  // The status page fetches billing + case stage fresh from Airtable on each
  // render (no-store), so re-rendering the path pulls the latest data and
  // updates the "Last refreshed" timestamp.
  revalidatePath("/status")
}
