// Client: upload a dropped file to the firm's Google Drive folder.
import { getPortalClient } from "@/lib/portal-client"
import { sql } from "@/lib/db"
import { uploadToDrive, ensureFolderPath } from "@/lib/google-drive"
import { NextResponse } from "next/server"

export const runtime = "nodejs"

export async function POST(req: Request) {
  const client = await getPortalClient()
  if (!client) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const form = await req.formData().catch(() => null)
  const file = form?.get("file")
  if (!(file instanceof File)) return NextResponse.json({ error: "file required" }, { status: 400 })

  // relativePath is "folder/sub/name.pdf" when the file came from a dropped folder; just the
  // name for a loose file. Split into folder segments + the bare file name.
  const rawPath = (typeof form?.get("relativePath") === "string" ? (form!.get("relativePath") as string) : "") || file.name
  const segments = rawPath.split("/").map((s) => s.trim()).filter(Boolean)
  const baseName = segments.pop() || file.name
  const clientPrefix = client.name ? client.name + " — " : ""

  const folderId = process.env.MESSAGE_DOCS_DRIVE_FOLDER_ID || process.env.ROOT_DRIVE_FOLDER_ID || ""
  if (!process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    return NextResponse.json({ error: "File uploads aren't connected yet. Please email your documents for now." }, { status: 503 })
  }
  if (!folderId) {
    return NextResponse.json({ error: "File uploads aren't set up yet." }, { status: 503 })
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer())
    let targetFolder = folderId
    let name: string
    if (segments.length) {
      // Recreate the dropped folder structure in Drive. Prefix the top folder with the
      // client's name so the firm knows who sent it; files inside keep their own names.
      const pathSegments = [clientPrefix + segments[0], ...segments.slice(1)]
      targetFolder = await ensureFolderPath(folderId, pathSegments)
      name = baseName
    } else {
      // Loose file: prefix the file name with the client's name (existing behaviour).
      name = `${clientPrefix}${baseName}`
    }
    const result = await uploadToDrive(buffer, name, file.type, targetFolder)
    await sql`
      INSERT INTO dropzone_files (file_name, pathname, url, drive_status, uploaded_by)
      VALUES (${name}, ${"drive:" + (result.id ?? "")}, ${result.link ?? ""}, 'delivered', ${String(client.clientId)})
    `.catch(() => {})
    return NextResponse.json({ ok: true, link: result.link ?? null })
  } catch (e: any) {
    console.error("[file-dropzone client] drive upload failed:", e?.message)
    return NextResponse.json({ error: "Upload failed. Please try again." }, { status: 500 })
  }
}
