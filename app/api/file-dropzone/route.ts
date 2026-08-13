// Client: upload a dropped file to the firm's Google Drive folder.
import { getPortalClient } from "@/lib/portal-client"
import { deliverClientUpload, driveConfigured } from "@/lib/client-uploads"
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

  if (!process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    return NextResponse.json({ error: "File uploads aren't connected yet. Please email your documents for now." }, { status: 503 })
  }
  if (!driveConfigured()) {
    return NextResponse.json({ error: "File uploads aren't set up yet." }, { status: 503 })
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer())
    // Everything lands in the client's own folder; a dropped folder keeps its
    // structure underneath it.
    const { delivered, link } = await deliverClientUpload({
      clientId: String(client.clientId),
      fileName: baseName,
      buffer,
      mimeType: file.type,
      subPath: segments,
    })
    if (!delivered) return NextResponse.json({ error: "Upload failed. Please try again." }, { status: 500 })
    return NextResponse.json({ ok: true, link })
  } catch (e) {
    console.error("[file-dropzone client] drive upload failed:", e instanceof Error ? e.message : e)
    return NextResponse.json({ error: "Upload failed. Please try again." }, { status: 500 })
  }
}
