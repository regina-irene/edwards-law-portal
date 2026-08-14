// lib/file-views.ts — record that an attachment was opened. One row per open,
// written after the request has already been authorized, so the case log can
// show that a client actually looked at a document.
//
// Fail-soft on purpose: a logging problem must never stop someone from opening
// their file.
import { sql } from "@/lib/db"

export type FileViewScope = "task" | "message"
export type ViewerRole = "client" | "firm"

export async function recordFileView(opts: {
  scope: FileViewScope
  fileId: string
  clientId: string | null
  viewerEmail: string | null
  viewerRole: ViewerRole
}): Promise<void> {
  const { scope, fileId, clientId, viewerEmail, viewerRole } = opts
  try {
    await sql`
      INSERT INTO file_views (scope, file_id, client_id, viewer_email, viewer_role)
      VALUES (${scope}, ${String(fileId)}, ${clientId ? String(clientId) : null}, ${viewerEmail}, ${viewerRole})
    `
  } catch (e) {
    console.error("[file-views] could not record a file open:", e instanceof Error ? e.message : e)
  }
}
