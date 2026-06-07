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
  try {
    const result = await sql`
      SELECT header, announcement, embed_url, body, image_pathname, image_name FROM page_content
      WHERE (client_id = ${clientId} OR client_id = '_global') AND page = ${page}
      ORDER BY CASE WHEN client_id = ${clientId} THEN 0 ELSE 1 END
      LIMIT 1
    `
    if (result.rows.length === 0) return EMPTY
    const r = result.rows[0]
    return {
      header: r.header,
      announcement: r.announcement,
      embed_url: r.embed_url,
      body: r.body,
      image_pathname: r.image_pathname,
      image_name: r.image_name,
    }
  } catch (e) {
    console.error("[getPageContent]", e)
    return EMPTY
  }
}
