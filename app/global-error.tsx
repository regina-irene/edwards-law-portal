"use client"
// Last-resort boundary: catches failures in the root layout itself, so it must
// render its own <html>/<body>. The app stylesheet is not guaranteed here, so
// the few colors it needs are set inline.
import { useEffect } from "react"

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("[global error]", error)
  }, [error])

  return (
    <html lang="en">
      <body style={{ background: "#FBF8F3", margin: 0 }}>
        <div
          className="flex items-center justify-center"
          style={{ minHeight: "100vh", padding: "24px", fontFamily: "system-ui, sans-serif" }}
        >
          <div className="max-w-md text-center">
            <h1 className="text-xl font-semibold" style={{ color: "#1B2D45" }}>
              The portal is having trouble right now
            </h1>
            <p className="mt-3" style={{ color: "#4b5563" }}>
              We&apos;re sorry. Nothing you did caused this, and nothing in your case file was
              changed. Please try again, or check back in a few minutes.
            </p>
            <div className="mt-6">
              <button
                type="button"
                onClick={reset}
                className="px-4 py-2 rounded-lg text-sm font-semibold"
                style={{ background: "#1B2D45", color: "#ffffff", border: "none", cursor: "pointer" }}
              >
                Try again
              </button>
            </div>
          </div>
        </div>
      </body>
    </html>
  )
}
