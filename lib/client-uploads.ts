// lib/client-uploads.ts — every file a CLIENT uploads through the portal is
// also delivered to the firm's Google Drive folder, in a subfolder named after
// the client. Firm uploads stay in the portal only.
//
// Fail-soft by design: the file is already saved in the portal before we get
// here, so Drive trouble is logged (dropzone_files.drive_status = 'failed')
// but never fails the client's upload.
import { sql } from "@/lib/db"
import { uploadToDrive, ensureFolderPath } from "@/lib/google-drive"
import { fetchAllClientsRaw } from "@/lib/airtable"
import { getClientLabels } from "@/lib/client-labels"

// Airtable stores names as "Last | First"; the Drive folder spells the first
// name out ("Grey, Cleon") rather than the admin list's "Grey, C".
export function driveFolderName(name: string): string {
  const parts = (name ?? "").split("|").map((s) => s.trim()).filter(Boolean)
  const last = parts[0] ?? ""
  const first = parts[1] ?? ""
  if (last && first) return `${last}, ${first}`
  return last || first || ""
}

// Drive treats "/" as a path separator and trims oddly — keep folder names tame.
export function safeFolderName(name: string): string {
  return name.replace(/[\\/]+/g, "-").replace(/\s+/g, " ").trim().slice(0, 120)
}

export function clientUploadsRootFolderId(): string {
  return process.env.MESSAGE_DOCS_DRIVE_FOLDER_ID || process.env.ROOT_DRIVE_FOLDER_ID || ""
}

export function driveConfigured(): boolean {
  return Boolean(process.env.GOOGLE_SERVICE_ACCOUNT_JSON && clientUploadsRootFolderId())
}

// The client's folder name: a manual label override wins, then the Airtable
// name, then the raw id so a file is never dropped for want of a name.
export async function clientFolderLabel(clientId: string): Promise<string> {
  const cid = String(clientId)
  try {
    const [clients, labels] = await Promise.all([fetchAllClientsRaw(), getClientLabels()])
    const match = clients.find((c) => String(c.clientId) === cid)
    const label = labels[cid] || (match ? driveFolderName(match.name) : "")
    return safeFolderName(label) || cid
  } catch {
    return cid
  }
}

export interface DeliverResult {
  delivered: boolean
  link: string | null
}

// Copy one client upload into Drive under <root>/<client>/<subPath…>.
export async function deliverClientUpload(opts: {
  clientId: string
  fileName: string
  buffer: Buffer
  mimeType?: string | null
  // extra folders below the client's folder (used for dropped folder uploads)
  subPath?: string[]
}): Promise<DeliverResult> {
  const { clientId, fileName, buffer, mimeType, subPath = [] } = opts
  const root = clientUploadsRootFolderId()
  if (!driveConfigured()) {
    console.warn("[client-uploads] Drive not configured — file stayed in the portal only:", fileName)
    return { delivered: false, link: null }
  }

  const cid = String(clientId)
  try {
    const label = await clientFolderLabel(cid)
    const segments = [label, ...subPath.map(safeFolderName).filter(Boolean)]
    const targetFolder = await ensureFolderPath(root, segments)
    const result = await uploadToDrive(buffer, fileName, mimeType || "application/octet-stream", targetFolder)
    await sql`
      INSERT INTO dropzone_files (file_name, pathname, url, drive_status, uploaded_by)
      VALUES (${fileName}, ${"drive:" + (result.id ?? "")}, ${result.link ?? ""}, 'delivered', ${cid})
    `.catch(() => {})
    return { delivered: true, link: result.link ?? null }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    console.error("[client-uploads] Drive delivery failed for", fileName, "-", message)
    await sql`
      INSERT INTO dropzone_files (file_name, pathname, url, drive_status, uploaded_by)
      VALUES (${fileName}, ${"drive:failed"}, ${""}, 'failed', ${cid})
    `.catch(() => {})
    return { delivered: false, link: null }
  }
}
