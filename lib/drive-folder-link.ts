// lib/drive-folder-link.ts - "is this link a Google Drive FOLDER?"
//
// Split out from lib/drive-folder so a CLIENT component can ask the question
// without pulling in googleapis. Importing lib/drive-folder from the browser
// bundle would drag the whole Google API client in with it, and fail the build.
export function isDriveFolderLink(url: string | null | undefined): boolean {
  if (!url) return false
  if (!/drive\.google\.com/i.test(url)) return false
  if (/\/file\/d\//.test(url)) return false
  if (/\/folders\/[a-zA-Z0-9_-]{10,}/.test(url)) return true
  try {
    const id = new URL(url).searchParams.get("id")
    return Boolean(id && /^[a-zA-Z0-9_-]{10,}$/.test(id))
  } catch {
    return false
  }
}
