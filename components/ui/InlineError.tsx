"use client"
// components/ui/InlineError.tsx — inline error with a retry, used wherever a
// save can fail. Says what went wrong next to the thing that went wrong,
// instead of a browser alert.
export function InlineError({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <p className="text-xs text-red-600 mt-1">
      {message}
      {onRetry && (
        <button type="button" onClick={onRetry} className="ml-2 underline hover:text-red-800">Try again</button>
      )}
    </p>
  )
}
