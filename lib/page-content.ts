// lib/page-content.ts
import { sql } from "@/lib/db"

export interface PageContent {
  header: string | null
  announcement: string | null
  embed_url: string | null
  body: string | null
  image_pathname: string | null
  image_name: string | null
}

const EMPTY: PageContent = {
  header: null,
  announcement: null,
  embed_url: null,
  body: null,
  image_pathname: null,
  image_name: null,
}

export async function getPageContent(clientId: string, page: string): Promise<PageContent> {
  // "Client ID" is an Airtable linked-record field, so at runtime it can be an
  // array; normalize to the bare id string that page_content rows are keyed on.
  const cid = String(clientId)
  try {
    const result = await sql`
      SELECT client_id, header, announcement, embed_url, body, image_pathname, image_name FROM page_content
      WHERE client_id IN (${cid}, '_global') AND page = ${page}
    `
    const clientRow = result.rows.find((r) => r.client_id === cid)
    const globalRow = result.rows.find((r) => r.client_id === "_global")
    if (!clientRow && !globalRow) return EMPTY
    // Per-field: use the client's value when set, otherwise the global default.
    const pick = (f: string) => (clientRow?.[f] ?? null) ?? (globalRow?.[f] ?? null)
    const useClientImage = clientRow?.image_pathname != null
    return {
      header: pick("header"),
      announcement: pick("announcement"),
      embed_url: pick("embed_url"),
      body: pick("body"),
      image_pathname: useClientImage ? clientRow!.image_pathname : globalRow?.image_pathname ?? null,
      image_name: useClientImage ? clientRow!.image_name : globalRow?.image_name ?? null,
    }
  } catch (e) {
    console.error("[getPageContent]", e)
    return EMPTY
  }
}
