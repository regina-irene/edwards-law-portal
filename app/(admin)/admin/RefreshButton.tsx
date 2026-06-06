"use client"

import { useFormStatus } from "react-dom"

export default function RefreshButton() {
  const { pending } = useFormStatus()
  return (
    <div className="flex flex-col items-end gap-1 w-44">
      <button
        type="submit"
        disabled={pending}
        className="w-full text-sm bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-70 flex items-center justify-center gap-2"
      >
        {pending && (
          <span
            className="inline-block h-3.5 w-3.5 rounded-full border-2 border-white/40 border-t-white animate-spin"
            aria-hidden
          />
        )}
        {pending ? "Refreshing…" : "Refresh from Airtable"}
      </button>
      {pending && (
        <div className="w-full h-1 overflow-hidden rounded-full bg-blue-100">
          <div className="h-full w-1/3 rounded-full bg-blue-600 animate-refresh-bar" />
        </div>
      )}
    </div>
  )
}
