"use client"
// Error boundary for the admin side — staff-facing, so it may show the digest.
import { useEffect } from "react"
import Link from "next/link"

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("[admin error]", error)
  }, [error])

  return (
    <div className="flex items-center justify-center py-24">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold" style={{ color: "#1B2D45" }}>
          This admin page failed to load
        </h1>
        <p className="mt-3 text-gray-600">
          An unexpected error occurred while rendering this page. Try again, and if it keeps
          happening send the reference below to whoever maintains the portal.
        </p>
        {error.digest && (
          <p className="mt-4 text-xs font-mono text-gray-500">Reference: {error.digest}</p>
        )}
        <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={reset}
            className="px-4 py-2 rounded-lg bg-[#1B2D45] text-white text-sm font-semibold hover:opacity-90"
          >
            Try again
          </button>
          <Link
            href="/admin"
            className="px-4 py-2 rounded-lg bg-white border border-gray-300 text-gray-600 text-sm hover:border-gray-500"
          >
            Back to admin home
          </Link>
        </div>
      </div>
    </div>
  )
}
