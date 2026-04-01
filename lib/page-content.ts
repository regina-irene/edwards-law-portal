// lib/page-content.ts
import { sql } from "@/lib/db"

export interface PageContent {
  header: string | null
  announcement: string | null
}

export async function getPageContent(clientId: string, page: string): Promise<PageContent> {
  try {
    const result = await sql`
      SELECT header, announcement FROM page_content
      WHERE client_id = ${clientId} AND page = ${page}
    `
    if (result.rows.length === 0) return { header: null, announcement: null }
    return { header: result.rows[0].header, announcement: result.rows[0].announcement }
  } catch (e) {
    console.error("[getPageContent]", e)
    return { header: null, announcement: null }
  }
}
