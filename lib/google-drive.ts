// Google Drive upload via the same service account FileFlow uses.
import { google } from "googleapis"
import { Readable } from "node:stream"

export function getDriveClient() {
  const keyJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON
  if (!keyJson) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON is not set")
  const credentials = JSON.parse(keyJson.trim())
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/drive.file"],
  })
  return google.drive({ version: "v3", auth })
}

export async function uploadToDrive(
  buffer: Buffer,
  name: string,
  mimeType: string,
  folderId: string
): Promise<{ id: string | null | undefined; link: string | null | undefined }> {
  const drive = getDriveClient()
  const res = await drive.files.create({
    requestBody: { name, parents: folderId ? [folderId] : undefined },
    media: { mimeType: mimeType || "application/octet-stream", body: Readable.from(buffer) },
    fields: "id, webViewLink",
    supportsAllDrives: true,
  })
  return { id: res.data.id, link: res.data.webViewLink }
}
