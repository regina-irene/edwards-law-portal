// Instant feedback while a client page loads its data.
export default function Loading() {
  return (
    <div className="flex items-center justify-center py-24">
      <div className="flex items-center gap-3 text-gray-500">
        <span className="inline-block h-5 w-5 rounded-full border-2 border-gray-300 border-t-gray-600 animate-spin" aria-hidden />
        <span className="text-sm">Loading…</span>
      </div>
    </div>
  )
}
