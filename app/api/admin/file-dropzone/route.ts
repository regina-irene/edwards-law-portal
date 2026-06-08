// Admin: upload a dropped file to the firm's Google Drive folder.
import { requireAdmin } from "@/lib/admin"
import { sql } from "@/lib/db"
import { uploadToDrive } from "@/lib/google-drive"
import { NextResponse } from "next/server"

export const runtime = "nodejs"

export async function POST(req: Request) {
  const check = await requireAdmin()
  if (check.status !== "ok") return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const form = await req.formData().catch(() => null)
  const file = form?.get("file")
  const folderOverride = form?.get("folderId")
  if (!(file instanceof File)) return NextResponse.json({ error: "file required" }, { status: 400 })

  const folderId =
    (typeof folderOverride === "string" && folderOverride.trim()) ||
    process.env.MESSAGE_DOCS_DRIVE_FOLDER_ID ||
    process.env.ROOT_DRIVE_FOLDER_ID ||
    ""

  if (!process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    return NextResponse.json({ error: "Google Drive isn't connected yet (service account key missing)." }, { status: 503 })
  }
  if (!folderId) {
    return NextResponse.json({ error: "No Drive folder configured." }, { status: 503 })
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer())
    const result = await uploadToDrive(buffer, file.name, file.type, folderId)
    await sql`
      INSERT INTO dropzone_files (file_name, pathname, url, drive_status, uploaded_by)
      VALUES (${file.name}, ${"drive:" + (result.id ?? "")}, ${result.link ?? ""}, 'delivered', ${check.email})
    `.catch(() => {})
    return NextResponse.json({ ok: true, link: result.link ?? null })
  } catch (e: any) {
    console.error("[file-dropzone] drive upload failed:", e?.message)
    return NextResponse.json({ error: "Upload to Drive failed. Check the folder + service account." }, { status: 500 })
  }
}
