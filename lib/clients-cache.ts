import { unstable_cache } from "next/cache"
import { fetchAllClientsRaw, type AirtableClient } from "./airtable"

// Cached client list that also records when the data was last pulled from
// Airtable. Tagged "clients" so the admin Refresh button can expire it on
// demand via updateTag("clients").
export const getAllClientsWithMeta = unstable_cache(
  async (): Promise<{ clients: AirtableClient[]; fetchedAt: number }> => {
    const clients = await fetchAllClientsRaw()
    return { clients, fetchedAt: Date.now() }
  },
  ["all-clients-with-meta"],
  { tags: ["clients"], revalidate: 60 }
)
