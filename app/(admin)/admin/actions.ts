"use server"

import { revalidatePath, updateTag } from "next/cache"
import { setClientLabel } from "@/lib/client-labels"

export async function refreshClients() {
  // updateTag (Server Action only) expires the "clients" cache immediately so
  // the re-render fetches fresh Airtable data, rather than serving stale.
  updateTag("clients")
}

export async function saveClientLabel(clientId: string, label: string) {
  await setClientLabel(clientId, label.trim())
  revalidatePath("/admin")
}
