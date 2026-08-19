// components/admin/ArchiveToggle.tsx - the "Active / Include archived" switch
// on the server-rendered admin lists (2026-08-19).
//
// It is two links rather than a checkbox on purpose: the state lives in the URL
// (?archived=1), so it survives a refresh, a Back, and a bookmark, and the page
// keeps rendering on the server. Any other query the page already carries
// (search text, filters, paging) is passed in and preserved.
import Link from "next/link"

export default function ArchiveToggle({
  basePath,
  includeArchived,
  archivedCount,
  keep,
}: {
  /** e.g. "/admin/clients" */
  basePath: string
  includeArchived: boolean
  /** How many archived clients are being hidden. Omit when it isn't known. */
  archivedCount?: number
  /** Other search params to carry across, so the toggle never clears a filter. */
  keep?: Record<string, string>
}) {
  const href = (on: boolean): string => {
    const params = new URLSearchParams(keep ?? {})
    if (on) params.set("archived", "1")
    else params.delete("archived")
    const qs = params.toString()
    return qs ? `${basePath}?${qs}` : basePath
  }

  const base = "px-3 py-1.5 text-xs font-semibold border transition-colors"
  const on = "text-white border-transparent"
  const off = "bg-white text-gray-600 border-gray-300 hover:border-gray-400"

  return (
    <div className="inline-flex rounded-full overflow-hidden border border-gray-300" role="group" aria-label="Archived clients">
      <Link
        href={href(false)}
        aria-current={!includeArchived ? "true" : undefined}
        className={`${base} rounded-l-full ${!includeArchived ? on : off} border-0`}
        style={!includeArchived ? { background: "#1b2d45" } : undefined}
      >
        Active only
      </Link>
      <Link
        href={href(true)}
        aria-current={includeArchived ? "true" : undefined}
        className={`${base} rounded-r-full ${includeArchived ? on : off} border-0 border-l border-gray-300`}
        style={includeArchived ? { background: "#1b2d45" } : undefined}
        title="Show former and closed cases as well"
      >
        Include archived
        {typeof archivedCount === "number" && archivedCount > 0 && (
          <span className={includeArchived ? "ml-1.5 opacity-70" : "ml-1.5 text-gray-400"}>{archivedCount}</span>
        )}
      </Link>
    </div>
  )
}
