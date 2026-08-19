// Shown to a client when a portal page or link doesn't exist.
import Link from "next/link"

export default function ClientNotFound() {
  return (
    <div className="flex items-center justify-center py-24">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold" style={{ color: "#1B2D45" }}>
          We couldn&apos;t find that page
        </h1>
        <p className="mt-3 text-gray-600">
          The link may be out of date, or the page may have been moved. Your case file is
          safe and everything else in your portal is working normally.
        </p>
        <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/dashboard"
            className="px-4 py-2 rounded-lg bg-[#1B2D45] text-white text-sm font-semibold hover:opacity-90"
          >
            Back to dashboard
          </Link>
          <Link
            href="/messages"
            className="px-4 py-2 rounded-lg bg-white border border-gray-300 text-gray-600 text-sm hover:border-gray-500"
          >
            Message your legal team
          </Link>
        </div>
      </div>
    </div>
  )
}
