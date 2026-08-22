// lib/drive-folder.ts - look inside a Google Drive folder that a Discovery row
// links to, so a link reads as "what is in here" rather than "click and find
// out" (2026-08-20).
//
// A Discovery URL is usually a Drive FOLDER, and a folder link tells the client
// nothing until they open it. This turns one into a short factual summary: the
// subfolders, how many files each holds, what kinds of file, and the span of
// dates they cover. Nothing is guessed and nothing is written - it is a read.
//
// ACCESS, WHICH IS THE PART THAT WILL BITE
// lib/google-drive authenticates with the `drive.file` scope, which by design
// only ever sees files the service account itself created. It cannot list a
// folder Regina made in her own Drive, which is exactly the kind this reads. So
// this module asks for `drive.readonly` instead.
//
// The wider scope is necessary but not sufficient. A plain service account has
// no standing access to anyone's Drive: the folder (or a parent of it, or the
// shared drive it lives in) still has to be SHARED with the service account's
// email address. Until that happens every read here returns "no access", which
// the UI shows as a plain sentence rather than an error. The service account
// email is the `client_email` in GOOGLE_SERVICE_ACCOUNT_JSON.
import { google } from "googleapis"
import { unstable_cache } from "next/cache"

export const DRIVE_FOLDER_CACHE_TAG = "drive-folder"

/** One subfolder inside the linked folder. */
export interface DriveSubfolder {
  id: string
  name: string
  fileCount: number
}

export interface DriveFolderSummary {
  folderId: string
  name: string
  /** Files sitting directly in the linked folder, not counting subfolders. */
  fileCount: number
  subfolders: DriveSubfolder[]
  /** "PDF", "Word", "Excel", "Image" and so on, most common first. */
  types: string[]
  /** Oldest and newest modified dates across the files, as ISO dates. */
  from: string | null
  to: string | null
  /** True when the listing stopped at the cap rather than at the end. */
  truncated: boolean
}

/** Why a folder could not be read, in words a person can act on. */
export type DriveFolderError =
  | { reason: "not-a-folder"; message: string }
  | { reason: "no-access"; message: string }
  | { reason: "not-configured"; message: string }
  | { reason: "failed"; message: string }

export type DriveFolderResult =
  | { ok: true; summary: DriveFolderSummary }
  | { ok: false; error: DriveFolderError }

/** Stop before a pathological folder turns one page view into a thousand calls. */
const MAX_FILES = 400
const MAX_SUBFOLDERS = 60

/**
 * The folder id inside a Drive URL, or null when the link is not a folder.
 *
 * Handles the shapes that actually turn up on the boards:
 *   drive.google.com/drive/folders/ID
 *   drive.google.com/drive/u/0/folders/ID
 *   drive.google.com/open?id=ID
 *   drive.google.com/drive/folderview?id=ID
 * A link to a single FILE returns null on purpose: there is nothing to expand.
 */
export function parseDriveFolderId(url: string): string | null {
  if (!url) return null
  const folders = /\/folders\/([a-zA-Z0-9_-]{10,})/.exec(url)
  if (folders) return folders[1]
  try {
    const id = new URL(url).searchParams.get("id")
    if (id && /^[a-zA-Z0-9_-]{10,}$/.test(id) && !/\/file\/d\//.test(url)) return id
  } catch {
    // not a URL at all
  }
  return null
}

function readonlyDrive() {
  const keyJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON
  if (!keyJson) return null
  // Parsing and client construction are inside the guard on purpose: a
  // malformed GOOGLE_SERVICE_ACCOUNT_JSON used to throw here, outside the
  // caller's try, which turned a configuration problem into an unhandled 500
  // instead of the "Drive isn't connected" sentence this file exists to give.
  try {
    const credentials = JSON.parse(keyJson.trim())
    const auth = new google.auth.GoogleAuth({
      credentials,
      // Read-only, and deliberately NOT the `drive.file` scope used for uploads:
      // that one cannot see a folder the service account did not create.
      scopes: ["https://www.googleapis.com/auth/drive.readonly"],
    })
    return google.drive({ version: "v3", auth })
  } catch (e) {
    console.error("[drive-folder] bad service account credentials:", e instanceof Error ? e.message : e)
    return null
  }
}

const FOLDER_MIME = "application/vnd.google-apps.folder"

/** Drive mime types turned into words a client would use. */
function friendlyType(mimeType: string, name: string): string {
  const m = mimeType.toLowerCase()
  if (m.includes("pdf")) return "PDF"
  if (m.includes("wordprocessingml") || m.includes("msword") || m.includes("document")) return "Word"
  if (m.includes("spreadsheet") || m.includes("excel")) return "Excel"
  if (m.includes("presentation") || m.includes("powerpoint")) return "Slides"
  if (m.startsWith("image/")) return "Image"
  if (m.startsWith("video/")) return "Video"
  if (m.startsWith("audio/")) return "Audio"
  if (m.includes("zip")) return "Archive"
  if (m.startsWith("text/")) return "Text"
  const ext = /\.([a-z0-9]{2,5})$/i.exec(name)?.[1]
  return ext ? ext.toUpperCase() : "File"
}

async function readFolder(folderId: string): Promise<DriveFolderResult> {
  const drive = readonlyDrive()
  if (!drive) {
    return {
      ok: false,
      error: {
        reason: "not-configured",
        message: "Google Drive isn't connected on this deployment.",
      },
    }
  }

  try {
    const meta = await drive.files.get({
      fileId: folderId,
      fields: "id, name, mimeType",
      supportsAllDrives: true,
    })
    if (meta.data.mimeType !== FOLDER_MIME) {
      return {
        ok: false,
        error: { reason: "not-a-folder", message: "That link points at a single file, not a folder." },
      }
    }

    const files: { name: string; mimeType: string; modifiedTime: string | null }[] = []
    const subfolders: DriveSubfolder[] = []
    let pageToken: string | undefined
    let truncated = false

    do {
      const res = await drive.files.list({
        q: `'${folderId}' in parents and trashed = false`,
        fields: "nextPageToken, files(id, name, mimeType, modifiedTime)",
        pageSize: 200,
        pageToken,
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
        orderBy: "folder,name",
      })
      for (const f of res.data.files ?? []) {
        if (f.mimeType === FOLDER_MIME) {
          if (subfolders.length < MAX_SUBFOLDERS) {
            subfolders.push({ id: String(f.id), name: String(f.name ?? "Untitled"), fileCount: 0 })
          } else {
            // Flag it, or a folder with eighty subfolders quietly reports sixty
            // and the "not everything was counted" note never appears.
            truncated = true
          }
        } else if (files.length < MAX_FILES) {
          files.push({
            name: String(f.name ?? ""),
            mimeType: String(f.mimeType ?? ""),
            modifiedTime: f.modifiedTime ?? null,
          })
        } else {
          truncated = true
        }
      }
      pageToken = res.data.nextPageToken ?? undefined
    } while (pageToken && !truncated)

    // One extra count per subfolder, so "Bank statements (14 files)" is real
    // rather than implied. Capped by MAX_SUBFOLDERS above; a failure on one
    // subfolder leaves it at zero rather than losing the whole summary.
    await Promise.all(
      subfolders.map(async (sf) => {
        try {
          const res = await drive.files.list({
            q: `'${sf.id}' in parents and trashed = false and mimeType != '${FOLDER_MIME}'`,
            fields: "files(id)",
            pageSize: 200,
            supportsAllDrives: true,
            includeItemsFromAllDrives: true,
          })
          sf.fileCount = (res.data.files ?? []).length
        } catch {
          sf.fileCount = 0
        }
      })
    )

    const typeCounts = new Map<string, number>()
    for (const f of files) {
      const t = friendlyType(f.mimeType, f.name)
      typeCounts.set(t, (typeCounts.get(t) ?? 0) + 1)
    }
    const types = [...typeCounts.entries()].sort((a, b) => b[1] - a[1]).map(([t]) => t)

    const dates = files
      .map((f) => f.modifiedTime)
      .filter((d): d is string => Boolean(d))
      .map((d) => d.slice(0, 10))
      .sort()

    return {
      ok: true,
      summary: {
        folderId,
        name: String(meta.data.name ?? "Folder"),
        fileCount: files.length,
        subfolders,
        types,
        from: dates[0] ?? null,
        to: dates[dates.length - 1] ?? null,
        truncated,
      },
    }
  } catch (e) {
    // Google's own reason, which is the only thing that actually says WHY.
    // The first version of this collapsed 403 and 404 into one "hasn't been
    // shared" sentence, which is wrong twice over: a 404 usually means the id
    // is not a folder we can see at all, and a 403 can equally mean the Drive
    // API is not enabled on the Cloud project (accessNotConfigured) or that a
    // Workspace policy forbids the service account. Those need different fixes,
    // so they are logged separately and shown separately.
    const err = e as {
      code?: number | string
      status?: number
      message?: string
      errors?: { reason?: string; message?: string }[]
      response?: { status?: number; data?: { error?: { message?: string; errors?: { reason?: string }[] } } }
    }
    const status =
      (typeof err.code === "number" ? err.code : undefined) ?? err.status ?? err.response?.status
    const reason =
      err.errors?.[0]?.reason ?? err.response?.data?.error?.errors?.[0]?.reason ?? ""
    const detail = err.response?.data?.error?.message ?? err.message ?? ""

    console.error(
      `[drive-folder] read failed folder=${folderId} status=${status ?? "?"} reason=${reason || "?"} detail=${detail.slice(0, 300)}`
    )

    if (reason === "accessNotConfigured" || /has not been used in project|is disabled/i.test(detail)) {
      return {
        ok: false,
        error: {
          reason: "not-configured",
          message:
            "The Google Drive API isn't switched on for the portal's Google project yet.",
        },
      }
    }
    if (status === 403) {
      return {
        ok: false,
        error: {
          reason: "no-access",
          message: "Google refused the portal access to this folder.",
        },
      }
    }
    if (status === 404) {
      return {
        ok: false,
        error: {
          reason: "no-access",
          message:
            "The portal can't find that folder. Either the link points somewhere that no longer exists, or the folder isn't visible to the portal.",
        },
      }
    }
    return { ok: false, error: { reason: "failed", message: "Couldn't read that folder just now." } }
  }
}

/**
 * A folder summary, cached for an hour.
 *
 * Discovery folders change rarely and this costs several Drive calls, so it is
 * cached hard. The cache key is the folder id, so two clients linking the same
 * folder share one read.
 */
export function summariseDriveFolder(folderId: string): Promise<DriveFolderResult> {
  return unstable_cache(() => readFolder(folderId), ["drive-folder", folderId], {
    revalidate: 3600,
    tags: [DRIVE_FOLDER_CACHE_TAG],
  })()
}
