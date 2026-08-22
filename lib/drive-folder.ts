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

export const DRIVE_FOLDER_CACHE_TAG = "drive-folder"

/** One subfolder inside the linked folder. */
export interface DriveSubfolder {
  id: string
  name: string
  /** Files anywhere beneath it, not just its direct children. */
  fileCount: number
}

export interface DriveFolderSummary {
  folderId: string
  name: string
  /**
   * EVERY file beneath the linked folder, at any depth.
   *
   * The first version counted only the files sitting loose at the top level and
   * called it "12 files", which read as the size of the whole folder. On an RPD
   * folder that keeps everything in subfolders that number was near zero and
   * plainly wrong. This is the real total; `looseFileCount` is the top level on
   * its own, for when that distinction matters.
   */
  fileCount: number
  /** Files sitting directly in the linked folder, outside any subfolder. */
  looseFileCount: number
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

/**
 * Limits, so one page view cannot turn into a thousand Drive calls.
 *
 * The walk is breadth-first and queries a whole level at once (Drive accepts
 * "'a' in parents or 'b' in parents"), so depth costs calls, width mostly does
 * not. That is what makes counting the entire tree affordable.
 */
const MAX_DEPTH = 6
const MAX_CALLS = 60
/** Parent ids per query. Drive rejects a query string that gets too long. */
const PARENTS_PER_QUERY = 25
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

    // Walk the WHOLE tree, breadth first, one query per level.
    //
    // Drive has no recursive listing, and asking each folder separately would
    // cost a call per folder. Instead every folder at a level is queried
    // together with "'a' in parents or 'b' in parents", so a wide folder costs
    // no more than a narrow one and only depth adds calls.
    //
    // Each file is credited to the TOP-LEVEL subfolder it ultimately sits
    // under, which is what makes "RPD 10 (37 files)" mean what it looks like it
    // means, however deeply those files are nested.
    let looseFileCount = 0
    let totalFiles = 0
    let truncated = false
    let calls = 0

    const subfolders: DriveSubfolder[] = []
    const countFor = new Map<string, number>()
    /** folder id -> the top-level subfolder it belongs to. */
    const rootOf = new Map<string, string>()
    const typeCounts = new Map<string, number>()
    const dates: string[] = []

    const note = (name: string, mimeType: string, modifiedTime: string | null) => {
      totalFiles++
      const t = friendlyType(mimeType, name)
      typeCounts.set(t, (typeCounts.get(t) ?? 0) + 1)
      if (modifiedTime) dates.push(modifiedTime.slice(0, 10))
    }

    let level: string[] = [folderId]
    for (let depth = 0; depth < MAX_DEPTH && level.length > 0; depth++) {
      const next: string[] = []

      for (let i = 0; i < level.length; i += PARENTS_PER_QUERY) {
        const chunk = level.slice(i, i + PARENTS_PER_QUERY)
        const q = `(${chunk.map((id) => `'${id}' in parents`).join(" or ")}) and trashed = false`
        let pageToken: string | undefined

        do {
          if (calls >= MAX_CALLS) {
            truncated = true
            break
          }
          calls++
          const res = await drive.files.list({
            q,
            // `parents` is what lets a file be credited to the right subfolder.
            fields: "nextPageToken, files(id, name, mimeType, modifiedTime, parents)",
            pageSize: 1000,
            pageToken,
            supportsAllDrives: true,
            includeItemsFromAllDrives: true,
          })

          for (const f of res.data.files ?? []) {
            const parent = (f.parents ?? []).find((pid) => chunk.includes(String(pid)))
            const parentId = String(parent ?? chunk[0])
            const isFolder = f.mimeType === FOLDER_MIME

            if (isFolder) {
              const id = String(f.id)
              if (depth === 0) {
                // A top-level subfolder: its own root, and its own line on screen.
                if (subfolders.length < MAX_SUBFOLDERS) {
                  subfolders.push({ id, name: String(f.name ?? "Untitled"), fileCount: 0 })
                  rootOf.set(id, id)
                  countFor.set(id, 0)
                  next.push(id)
                } else {
                  truncated = true
                }
              } else {
                const root = rootOf.get(parentId)
                if (root) rootOf.set(id, root)
                next.push(id)
              }
              continue
            }

            note(String(f.name ?? ""), String(f.mimeType ?? ""), f.modifiedTime ?? null)
            if (depth === 0) {
              looseFileCount++
            } else {
              const root = rootOf.get(parentId)
              if (root) countFor.set(root, (countFor.get(root) ?? 0) + 1)
            }
          }

          pageToken = res.data.nextPageToken ?? undefined
        } while (pageToken)

        if (truncated) break
      }

      if (truncated) break
      level = next
    }

    for (const sf of subfolders) sf.fileCount = countFor.get(sf.id) ?? 0

    const types = [...typeCounts.entries()].sort((a, b) => b[1] - a[1]).map(([t]) => t)
    dates.sort()

    return {
      ok: true,
      summary: {
        folderId,
        name: String(meta.data.name ?? "Folder"),
        fileCount: totalFiles,
        looseFileCount,
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
 * How long a result is kept, and why the two differ.
 *
 * A SUCCESS is cached hard: discovery folders change rarely and each read costs
 * several Drive calls, so an hour is cheap and two clients linking the same
 * folder share one read.
 *
 * A FAILURE is cached for a minute, and that distinction matters. The first
 * version cached both for an hour, which set a trap: "this folder hasn't been
 * shared" would be remembered for an hour, so the moment you fixed the sharing
 * in Drive and came back to check, the portal would confidently repeat the old
 * answer with no sign it was doing so. A minute is long enough to stop a
 * frustrated person hammering the Drive API and short enough that a fix shows
 * up while they are still looking at the screen.
 */
const OK_TTL_MS = 60 * 60 * 1000
const FAIL_TTL_MS = 60 * 1000

/**
 * Per-instance, deliberately.
 *
 * Not next/cache: unstable_cache has one revalidate window for whatever the
 * function returns, so it cannot hold a success for an hour and a failure for a
 * minute. A plain Map on the serverless instance can, and losing it when the
 * instance recycles costs nothing but a re-read.
 */
const cache = new Map<string, { at: number; result: DriveFolderResult }>()

export function clearDriveFolderCache(): void {
  cache.clear()
}

export async function summariseDriveFolder(folderId: string): Promise<DriveFolderResult> {
  const hit = cache.get(folderId)
  if (hit) {
    const ttl = hit.result.ok ? OK_TTL_MS : FAIL_TTL_MS
    if (Date.now() - hit.at < ttl) return hit.result
  }
  const result = await readFolder(folderId)
  cache.set(folderId, { at: Date.now(), result })
  // The map is per instance and folders are few, but an unbounded cache is
  // still an unbounded cache.
  if (cache.size > 500) {
    for (const k of [...cache.keys()].slice(0, 100)) cache.delete(k)
  }
  return result
}
