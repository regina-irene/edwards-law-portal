"use client"
// Friendly catch-all shown to a client when a portal page fails to load.
import { useEffect } from "react"
import Link from "next/link"

export default function ClientError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("[client error]", error)
  }, [error])

  return (
    <div className="flex items-center justify-center py-24">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold" style={{ color: "#1B2D45" }}>
          Something went wrong on our end
        </h1>
        <p className="mt-3 text-gray-600">
          This page didn&apos;t load the way it should have. Nothing you did caused it, and
          nothing in your case file was changed. Please try again in a moment.
        </p>
        <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={reset}
            className="px-4 py-2 rounded-lg bg-[#1B2D45] text-white text-sm font-semibold hover:opacity-90"
          >
            Try again
          </button>
          <Link
            href="/dashboard"
            className="px-4 py-2 rounded-lg bg-white border border-gray-300 text-gray-600 text-sm hover:border-gray-500"
          >
            Back to dashboard
          </Link>
        </div>
        <p className="mt-6 text-sm text-gray-500">
          Still stuck?{" "}
          <Link href="/messages" className="underline" style={{ color: "#1B2D45" }}>
            Send your legal team a message
          </Link>{" "}
          and someone will help you.
        </p>
      </div>
    </div>
  )
}
