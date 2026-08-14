// lib/drop-files.ts — read files out of a drag-and-drop event, walking into
// any dropped folders. Shared by the client "Send files" dropzone and the
// admin Message Center composer.
//
// IMPORTANT: the entries must be pulled off dataTransfer synchronously — the
// browser clears it as soon as the drop handler returns — so collect them
// first, then await the (async) file reads.

export interface DroppedFile {
  file: File
  // "Bank Statements/jan.pdf" for a file that came from a dropped folder,
  // otherwise just the file name.
  relativePath: string
}

interface FileSystemEntryLike {
  isFile: boolean
  isDirectory: boolean
  name: string
  file?: (cb: (f: File) => void, err: () => void) => void
  createReader?: () => { readEntries: (cb: (entries: FileSystemEntryLike[]) => void, err: () => void) => void }
}

// Recursively walk one dropped entry, collecting files with their paths.
function readEntry(entry: FileSystemEntryLike | null, parentPath: string, out: DroppedFile[]): Promise<void> {
  return new Promise((resolve) => {
    if (!entry) return resolve()
    if (entry.isFile && entry.file) {
      entry.file(
        (file: File) => { out.push({ file, relativePath: parentPath + file.name }); resolve() },
        () => resolve()
      )
    } else if (entry.isDirectory && entry.createReader) {
      const reader = entry.createReader()
      const acc: FileSystemEntryLike[] = []
      const readBatch = () => {
        reader.readEntries(
          (entries) => {
            if (entries.length === 0) {
              // readEntries returns in batches; an empty batch means we're done.
              Promise.all(acc.map((c) => readEntry(c, parentPath + entry.name + "/", out))).then(() => resolve())
            } else {
              acc.push(...entries)
              readBatch()
            }
          },
          () => resolve()
        )
      }
      readBatch()
    } else {
      resolve()
    }
  })
}

export async function collectDroppedFiles(dt: DataTransfer): Promise<DroppedFile[]> {
  const items = dt.items
  const canTraverse =
    items && items.length > 0 &&
    typeof (items[0] as DataTransferItem & { webkitGetAsEntry?: unknown }).webkitGetAsEntry === "function"

  if (canTraverse) {
    const entries = Array.from(items)
      .map((it) => (it as DataTransferItem & { webkitGetAsEntry: () => FileSystemEntryLike | null }).webkitGetAsEntry())
      .filter(Boolean) as FileSystemEntryLike[]
    const collected: DroppedFile[] = []
    await Promise.all(entries.map((en) => readEntry(en, "", collected)))
    return collected
  }

  return Array.from(dt.files).map((file) => ({
    file,
    relativePath: (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name,
  }))
}

// True when what's being dragged is actual files (not selected text or a link).
export function dragHasFiles(dt: DataTransfer | null): boolean {
  if (!dt) return false
  return Array.from(dt.types ?? []).includes("Files")
}
