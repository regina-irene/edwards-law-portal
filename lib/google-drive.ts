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

// Find a subfolder by name under a parent, or create it. Returns the folder id.
async function findOrCreateFolder(drive: ReturnType<typeof getDriveClient>, parentId: string, name: string): Promise<string> {
  const escaped = name.replace(/\\/g, "\\\\").replace(/'/g, "\\'")
  const q = `name = '${escaped}' and mimeType = 'application/vnd.google-apps.folder' and '${parentId}' in parents and trashed = false`
  const list = await drive.files.list({
    q,
    fields: "files(id, name)",
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
    spaces: "drive",
  })
  const existing = list.data.files?.[0]
  if (existing?.id) return existing.id
  const created = await drive.files.create({
    requestBody: { name, mimeType: "application/vnd.google-apps.folder", parents: [parentId] },
    fields: "id",
    supportsAllDrives: true,
  })
  return created.data.id as string
}

// Ensure a nested folder path (e.g. ["Bank Statements", "2024"]) exists under parentId.
// Returns the id of the deepest folder so files can be placed inside it.
export async function ensureFolderPath(parentId: string, segments: string[]): Promise<string> {
  const drive = getDriveClient()
  let current = parentId
  for (const seg of segments) {
    if (!seg) continue
    current = await findOrCreateFolder(drive, current, seg)
  }
  return current
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
